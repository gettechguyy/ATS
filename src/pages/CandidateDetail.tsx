import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import ResumeUpload from "@/components/ResumeUpload";
import { fetchCandidateById, updateCandidateStatus, updateCandidate as updateCandidateFn } from "../../dbscripts/functions/candidates";
import { fetchSubmissionsByCandidate, createSubmission as createSubmissionFn } from "../../dbscripts/functions/submissions";
import { fetchProfileName } from "../../dbscripts/functions/profiles";

const CANDIDATE_STATUSES = ["New", "In Marketing", "Placed", "Backout", "On Bench", "In Training"] as const;

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, isCandidate } = useAuth();
  const queryClient = useQueryClient();
  const [subDialogOpen, setSubDialogOpen] = useState(false);

  if (isCandidate) return <Navigate to="/" replace />;

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => fetchCandidateById(id!),
    enabled: !!id,
  });

  const { data: submissions } = useQuery({
    queryKey: ["candidate-submissions", id],
    queryFn: () => fetchSubmissionsByCandidate(id!),
    enabled: !!id,
  });

  const { data: recruiterProfile } = useQuery({
    queryKey: ["recruiter-profile", candidate?.recruiter_id],
    queryFn: () => fetchProfileName(candidate!.recruiter_id!),
    enabled: !!candidate?.recruiter_id,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => updateCandidateStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Status updated");
    },
  });

  const updateCandidate = useMutation({
    mutationFn: (updates: Record<string, any>) => updateCandidateFn(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Candidate updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createSubmission = useMutation({
    mutationFn: async (fd: FormData) => {
      await createSubmissionFn({
        candidate_id: id!,
        recruiter_id: user!.id,
        client_name: fd.get("client_name") as string,
        position: fd.get("position") as string,
        status: "Applied",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-submissions", id] });
      setSubDialogOpen(false);
      toast.success("Submission added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!candidate) {
    return <div className="text-center text-muted-foreground py-12">Candidate not found</div>;
  }

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/candidates"><ArrowLeft className="mr-2 h-4 w-4" />Back to Candidates</Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">{candidate.first_name} {candidate.last_name || ""}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Email:</span> {candidate.email || "—"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {candidate.phone || "—"}</div>
            <div><span className="text-muted-foreground">Recruiter:</span> {recruiterProfile?.full_name || "—"}</div>
            <div>
              <span className="text-muted-foreground">Resume:</span>
              <ResumeUpload
                candidateId={candidate.id}
                currentUrl={candidate.resume_url}
                onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
              />
            </div>
            {isAdmin && (
              <div className="pt-2">
                <Label className="text-muted-foreground">Status (Admin only)</Label>
                <Select value={candidate.status!} onValueChange={(v) => updateStatus.mutate(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANDIDATE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isAdmin && (
              <div className="pt-2">
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge variant="outline">{candidate.status}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Submissions ({submissions?.length || 0})
            </CardTitle>
            <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" />Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Submission</DialogTitle></DialogHeader>
                <form
                  onSubmit={(e) => { e.preventDefault(); createSubmission.mutate(new FormData(e.currentTarget)); }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Client Name *</Label>
                    <Input name="client_name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Position *</Label>
                    <Input name="position" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={createSubmission.isPending}>
                    Add Submission
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No submissions yet</TableCell>
                  </TableRow>
                ) : (
                  submissions?.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.client_name}</TableCell>
                      <TableCell>{s.position}</TableCell>
                      <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/submissions/${s.id}`}><Calendar className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
