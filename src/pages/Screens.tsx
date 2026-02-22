import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchSubmissions, fetchSubmissionsByRecruiter, fetchSubmissionsByCandidate, updateSubmission } from "../../dbscripts/functions/submissions";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function ScreensPage() {
  const { user, profile, isCandidate, isRecruiter, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [outcomeSubmission, setOutcomeSubmission] = useState<any | null>(null);
  const [outcomeChoice, setOutcomeChoice] = useState<"Positive" | "Negative" | "DidNotHappen">("Positive");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [outcomeBy, setOutcomeBy] = useState<"candidate" | "recruiter">("recruiter");

  const submissionsQueryFn = async () => {
    if (isCandidate) {
      if (!profile?.linked_candidate_id) return [];
      return fetchSubmissionsByCandidate(profile.linked_candidate_id);
    }
    if (isRecruiter && user?.id) return fetchSubmissionsByRecruiter(user.id);
    return fetchSubmissions();
  };

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["submissions-screens", user?.id, profile?.linked_candidate_id],
    queryFn: submissionsQueryFn,
  });

  const screens = submissions.filter((s: any) => s && (s.status === "Screen Call" || s.screen_scheduled_at));

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      await updateSubmission(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions-screens"] });
      toast.success("Saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Screen Calls</h1>
        <p className="text-sm text-muted-foreground">Manage scheduled screen calls and outcomes</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {!isCandidate && <TableHead>Candidate</TableHead>}
                <TableHead>Client</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Resume / Qs</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="w-36">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {screens.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No screen calls</TableCell></TableRow>
              ) : screens.map((s: any) => (
                <TableRow key={s.id}>
                  {!isCandidate && <TableCell className="font-medium">{s.candidates?.first_name} {s.candidates?.last_name || ""}</TableCell>}
                  <TableCell>{s.client_name}</TableCell>
                  <TableCell>{s.position}</TableCell>
                  <TableCell className="text-muted-foreground">{s.screen_scheduled_at ? new Date(s.screen_scheduled_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.screen_mode || "—"}</TableCell>
                  <TableCell>
                    {s.screen_resume_url ? <a href={s.screen_resume_url} target="_blank" rel="noreferrer" className="text-xs text-info underline mr-2">Resume</a> : null}
                    {s.screen_questions_url ? <a href={s.screen_questions_url} target="_blank" rel="noreferrer" className="text-xs text-info underline">Questions</a> : null}
                    {!s.screen_resume_url && !s.screen_questions_url && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Candidate: {s.screen_candidate_status || "None"}</div>
                      <div>Recruiter: {s.screen_recruiter_status || "None"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Candidate action */}
                      {isCandidate && profile?.linked_candidate_id === s.candidate_id && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm">{s.screen_candidate_status || "No"}</div>
                          <Button size="sm" onClick={() => {
                            setOutcomeBy("candidate");
                            setOutcomeSubmission(s);
                            setOutcomeChoice(s.screen_candidate_status || "Positive");
                            setOutcomeNote(s.screen_candidate_note || "");
                            setOutcomeDialogOpen(true);
                          }}>
                            {s.screen_candidate_status ? "Update" : "Mark"}
                          </Button>
                        </div>
                      )}
                      {/* Recruiter/Admin action */}
                      {(isRecruiter || isAdmin) && !isCandidate && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm">{s.screen_recruiter_status || "No"}</div>
                          <Button size="sm" onClick={() => {
                            setOutcomeBy("recruiter");
                            setOutcomeSubmission(s);
                            setOutcomeChoice(s.screen_recruiter_status || "Positive");
                            setOutcomeNote(s.screen_recruiter_note || "");
                            setOutcomeDialogOpen(true);
                          }}>
                            {s.screen_recruiter_status ? "Update" : "Done"}
                          </Button>
                          {s.screen_recruiter_status === "Positive" && (
                            <Button size="sm" asChild><Link to={`/submissions/${s.id}`}>Add Interview</Link></Button>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={outcomeDialogOpen} onOpenChange={setOutcomeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Screen Outcome</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!outcomeSubmission) return;
            try {
              const payload: any = {};
              if (outcomeBy === "candidate") {
                payload.screen_candidate_status = outcomeChoice;
                payload.screen_candidate_note = outcomeNote || null;
                payload.screen_candidate_attended = true;
              } else {
                // recruiter
                payload.screen_recruiter_status = outcomeChoice;
                payload.screen_recruiter_note = outcomeNote || null;
                payload.screen_recruiter_done = true;
                // if recruiter marks positive, set next step to Interview
                if (outcomeChoice === "Positive") payload.screen_next_step = "Interview";
                else payload.screen_next_step = null;
              }
              await updateMutation.mutateAsync({ id: outcomeSubmission.id, payload });
              setOutcomeDialogOpen(false);
              setOutcomeSubmission(null);
              setOutcomeNote("");
            } catch (err: any) {
              toast.error(err?.message || "Failed to save outcome");
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={outcomeChoice} onValueChange={(v: any) => setOutcomeChoice(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Positive">Positive</SelectItem>
                  <SelectItem value="Negative">Negative</SelectItem>
                  <SelectItem value="DidNotHappen">Didn't Happen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} placeholder="Optional notes..." />
            </div>
            <Button type="submit" className="w-full">Save Outcome</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

