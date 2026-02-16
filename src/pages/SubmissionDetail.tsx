import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Calendar, Gift, Clock } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSubmissionById } from "../../dbscripts/functions/submissions";
import { getStateName } from "@/lib/usStates";
import {
  fetchInterviewsBySubmission,
  createInterview as createInterviewFn,
  updateInterviewStatus as updateInterviewStatusFn,
  updateInterviewFeedback as updateInterviewFeedbackFn,
  rescheduleInterview as rescheduleInterviewFn,
} from "../../dbscripts/functions/interviews";
import { uploadOfferFile } from "../../dbscripts/functions/storage";
import { updateSubmissionStatus } from "../../dbscripts/functions/submissions";
import { fetchRescheduleLogsByInterviewIds } from "../../dbscripts/functions/rescheduleLogs";
import {
  fetchOffersBySubmission,
  createOffer as createOfferFn,
  updateOfferStatus as updateOfferStatusFn,
} from "../../dbscripts/functions/offers";
import { updateCandidateStatus } from "../../dbscripts/functions/candidates";

const INTERVIEW_STATUSES = ["Scheduled", "Passed", "Rejected", "Rescheduled"] as const;
const INTERVIEW_MODES = ["Virtual", "Onsite", "Phone"] as const;
const OFFER_STATUSES = ["Pending", "Accepted", "Declined"] as const;

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isCandidate } = useAuth();
  const queryClient = useQueryClient();
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleInterviewId, setRescheduleInterviewId] = useState<string | null>(null);

  const { data: submission, isLoading } = useQuery({
    queryKey: ["submission", id],
    queryFn: () => fetchSubmissionById(id!),
    enabled: !!id,
  });

  const { data: interviews } = useQuery({
    queryKey: ["submission-interviews", id],
    queryFn: () => fetchInterviewsBySubmission(id!),
    enabled: !!id,
  });

  const { data: offers } = useQuery({
    queryKey: ["submission-offers", id],
    queryFn: () => fetchOffersBySubmission(id!),
    enabled: !!id,
  });

  const { data: rescheduleLogs } = useQuery({
    queryKey: ["reschedule-logs", id],
    queryFn: () => fetchRescheduleLogsByInterviewIds(interviews!.map((i: any) => i.id)),
    enabled: !!interviews && interviews.length > 0,
  });

  const nextRound = (interviews?.length || 0) + 1;

  if (isCandidate && submission && profile?.linked_candidate_id && submission.candidate_id !== profile.linked_candidate_id)
    return <Navigate to="/submissions" replace />;

  const createInterview = useMutation({
    mutationFn: async (fd: FormData) => {
      const mode = fd.get("mode") as string;
      await createInterviewFn({
        submission_id: id!,
        candidate_id: submission!.candidate_id,
        round_number: nextRound,
        mode,
        scheduled_at: `${fd.get("date")}T${fd.get("time")}:00`,
        virtual_link: mode === "Virtual" ? (fd.get("virtual_link") as string) || null : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-interviews", id] });
      setInterviewDialogOpen(false);
      toast.success("Interview scheduled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateInterviewStatus = useMutation({
    mutationFn: async ({ interviewId, status }: { interviewId: string; status: string }) => {
      await updateInterviewStatusFn(interviewId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-interviews", id] });
      toast.success("Interview status updated");
    },
  });

  const updateInterviewFeedback = useMutation({
    mutationFn: async ({ interviewId, feedback }: { interviewId: string; feedback: string }) => {
      await updateInterviewFeedbackFn(interviewId, feedback);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-interviews", id] });
      toast.success("Feedback saved");
    },
  });

  const rescheduleInterview = useMutation({
    mutationFn: async ({ interviewId, newDate }: { interviewId: string; newDate: string }) => {
      const interview = interviews?.find((i: any) => i.id === interviewId);
      if (!interview) throw new Error("Interview not found");
      await rescheduleInterviewFn(interviewId, interview.scheduled_at, newDate, user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-interviews", id] });
      queryClient.invalidateQueries({ queryKey: ["reschedule-logs", id] });
      setRescheduleDialogOpen(false);
      setRescheduleInterviewId(null);
      toast.success("Interview rescheduled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [offerJobDescText, setOfferJobDescText] = useState("");
  const [offerJobDescUrl, setOfferJobDescUrl] = useState<string | null>(null);
  const [offerFileUploading, setOfferFileUploading] = useState(false);

  const handleOfferFileUpload = async (file: File) => {
    if (!id) return;
    setOfferFileUploading(true);
    try {
      const url = await uploadOfferFile(id, file);
      setOfferJobDescUrl(url);
      toast.success("Offer document uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setOfferFileUploading(false);
    }
  };

  const createOffer = useMutation({
    mutationFn: async (payload: { salary: number; job_description?: string | null; job_description_url?: string | null }) => {
      await createOfferFn({
        submission_id: id!,
        candidate_id: submission!.candidate_id,
        salary: payload.salary,
        job_description: payload.job_description ?? null,
        job_description_url: payload.job_description_url ?? null,
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["submission-offers", id] });
      setOfferDialogOpen(false);
      toast.success("Offer created");
      // set submission status to Offered
      try {
        await updateSubmissionStatus(id!, "Offered");
        queryClient.invalidateQueries({ queryKey: ["submission", id] });
      } catch (err) {
        // ignore but notify
        toast.error("Offer saved but couldn't update submission status");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateOfferStatus = useMutation({
    mutationFn: async ({ offerId, status }: { offerId: string; status: string }) => {
      await updateOfferStatusFn(offerId, status);
      if (status === "Accepted" && submission?.candidate_id) {
        await updateCandidateStatus(submission.candidate_id, "Placed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission-offers", id] });
      toast.success("Offer status updated");
    },
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!submission) {
    return <div className="py-12 text-center text-muted-foreground">Submission not found</div>;
  }

  const canCreateInterview = submission.status === "Interview" || submission.status === "Screen Call";
  const canCreateOffer = submission.status === "Offered";

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/submissions"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">{submission.position}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Client:</span> {submission.client_name}</div>
            <div><span className="text-muted-foreground">Candidate:</span> {(submission as any).candidates?.first_name} {(submission as any).candidates?.last_name || ""}</div>
            <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{submission.status}</Badge></div>
            <div><span className="text-muted-foreground">Created:</span> {new Date(submission.created_at!).toLocaleDateString()}</div>
            {submission.status === "Vendor Responded" && (
              <>
                <div><span className="text-muted-foreground">Rate:</span> {submission.rate ? `$${Number(submission.rate).toLocaleString()}` : "—"} {submission.rate_type ? `(${submission.rate_type})` : ""}</div>
                <div><span className="text-muted-foreground">Job Type:</span> {submission.job_type || "—"}</div>
                {submission.job_type && submission.job_type !== "Remote" && (
                  <div><span className="text-muted-foreground">Location:</span> {submission.city || "—"}, {submission.state ? getStateName(submission.state) : "—"}</div>
                )}
                <div><span className="text-muted-foreground">Job Description:</span> <div className="mt-1 whitespace-pre-wrap">{submission.job_description || "—"}</div></div>
              </>
            )}
            {submission.status === "Screen Call" && (
              <>
                <div><span className="text-muted-foreground">Scheduled:</span> {submission.screen_scheduled_at ? new Date(submission.screen_scheduled_at).toLocaleString() : "—"}</div>
                <div><span className="text-muted-foreground">Mode:</span> {submission.screen_mode || "—"}</div>
                {submission.screen_link_or_phone && (
                  <div><span className="text-muted-foreground">{submission.screen_mode === "Virtual" ? "Link" : "Phone"}:</span> {submission.screen_link_or_phone}</div>
                )}
                <div><span className="text-muted-foreground">Resume (Screen Call):</span> {submission.screen_resume_url ? <a href={submission.screen_resume_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-info underline">View</a> : "—"}</div>
                <div><span className="text-muted-foreground">Interview Questions:</span> {submission.screen_questions_url ? <a href={submission.screen_questions_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-info underline">View</a> : "—"}</div>
                <div><span className="text-muted-foreground">Screen Response:</span> {submission.screen_response_status || "—"}</div>
                {submission.screen_response_status === "No" && (
                  <div><span className="text-muted-foreground">Rejection Note:</span> <div className="mt-1 whitespace-pre-wrap">{submission.screen_rejection_note || "—"}</div></div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {/* Interviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" /> Interviews ({interviews?.length || 0})
              </CardTitle>
              <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!canCreateInterview}>
                    <Plus className="mr-1 h-3 w-3" />Schedule Round {nextRound}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Schedule Interview Round {nextRound}</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const date = fd.get("date") as string | null;
                      const time = fd.get("time") as string | null;
                      const mode = fd.get("mode") as string | null;
                      const link = (fd.get("virtual_link") as string) || "";
                      if (!date || !time) {
                        toast.error("Date and time are required");
                        return;
                      }
                      if (!mode) {
                        toast.error("Mode is required");
                        return;
                      }
                      if (mode === "Virtual") {
                        try {
                          new URL(link);
                        } catch {
                          toast.error("Please enter a valid meeting link for Virtual mode");
                          return;
                        }
                      } else if (mode === "Phone") {
                        const phone = link.trim();
                        const phoneRe = /^\+?[0-9\-\s()]{7,}$/;
                        if (!phoneRe.test(phone)) {
                          toast.error("Please enter a valid phone number for Phone mode");
                          return;
                        }
                      }
                      createInterview.mutate(new FormData(e.currentTarget));
                    }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date *</Label>
                        <Input name="date" type="date" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Time *</Label>
                        <Input name="time" type="time" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select name="mode" defaultValue="Virtual">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INTERVIEW_MODES.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Virtual Link (if Virtual mode)</Label>
                      <Input name="virtual_link" type="url" />
                    </div>
                    <Button type="submit" className="w-full" disabled={createInterview.isPending}>
                      Schedule Interview
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {interviews?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        {canCreateInterview ? "No interviews scheduled" : "Change submission status to 'Interview' or 'Screen Call' to schedule"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    interviews?.map((iv: any) => (
                      <TableRow key={iv.id}>
                        <TableCell className="font-medium">Round {iv.round_number}</TableCell>
                        <TableCell>{iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{iv.mode}</Badge>
                          {iv.mode === "Virtual" && iv.virtual_link && (
                            <a href={iv.virtual_link} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-info underline">Join</a>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select value={iv.status} onValueChange={async (v) => {
                            // update status, then if passed open offer dialog
                            try {
                              await updateInterviewStatus.mutateAsync({ interviewId: iv.id, status: v });
                              if (v === "Passed") {
                                setOfferDialogOpen(true);
                              }
                            } catch (err: any) {
                              toast.error(err.message || "Failed to update interview status");
                            }
                          }}>
                            <SelectTrigger className="h-7 w-auto border-0 p-0">
                              <Badge variant="secondary">{iv.status}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {INTERVIEW_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setRescheduleInterviewId(iv.id);
                                setRescheduleDialogOpen(true);
                              }}
                            >
                              <Clock className="mr-1 h-3 w-3" />Reschedule
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Reschedule Dialog */}
          <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Reschedule Interview</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                rescheduleInterview.mutate({
                  interviewId: rescheduleInterviewId!,
                  newDate: `${fd.get("new_date")}T${fd.get("new_time")}:00`,
                });
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>New Date *</Label>
                    <Input name="new_date" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label>New Time *</Label>
                    <Input name="new_time" type="time" required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={rescheduleInterview.isPending}>
                  Confirm Reschedule
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Reschedule History */}
          {rescheduleLogs && rescheduleLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" /> Reschedule History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Old Date</TableHead>
                      <TableHead>New Date</TableHead>
                      <TableHead>Changed At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rescheduleLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground">{log.old_date ? new Date(log.old_date).toLocaleString() : "—"}</TableCell>
                        <TableCell>{log.new_date ? new Date(log.new_date).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(log.changed_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Offers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4" /> Offers ({offers?.length || 0})
              </CardTitle>
              <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!canCreateOffer}>
                    <Plus className="mr-1 h-3 w-3" />Create Offer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Offer</DialogTitle></DialogHeader>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const salary = parseFloat(fd.get("salary") as string) || 0;
                    // require salary and either job description text or uploaded doc
                    if (!salary || salary <= 0) {
                      toast.error("Please enter a valid salary");
                      return;
                    }
                    if (!offerJobDescText && !offerJobDescUrl) {
                      toast.error("Please provide a job description (text or upload)");
                      return;
                    }
                    await createOffer.mutateAsync({
                      salary,
                      job_description: offerJobDescText || null,
                      job_description_url: offerJobDescUrl || null,
                    });
                    setOfferJobDescText("");
                    setOfferJobDescUrl(null);
                  }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Salary *</Label>
                      <Input name="salary" type="number" required placeholder="120000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Job Description (text)</Label>
                      <Textarea value={offerJobDescText} onChange={(e) => setOfferJobDescText(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Or upload Job Description document</Label>
                      <input type="file" accept=".pdf,.doc,.docx" onChange={(ev) => {
                        const f = ev.target.files?.[0];
                        if (!f) return;
                        handleOfferFileUpload(f);
                      }} />
                      {offerFileUploading && <div className="text-xs">Uploading...</div>}
                      {offerJobDescUrl && <a href={offerJobDescUrl} target="_blank" rel="noreferrer" className="text-xs text-info underline">View uploaded doc</a>}
                    </div>
                    <Button type="submit" className="w-full" disabled={createOffer.isPending}>
                      Create Offer
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Offered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                        {canCreateOffer ? "No offers yet" : "Change submission status to 'Offered' to create offers"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    offers?.map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">${Number(o.salary).toLocaleString()}</TableCell>
                        <TableCell>
                          <Select value={o.status} onValueChange={(v) => updateOfferStatus.mutate({ offerId: o.id, status: v })}>
                            <SelectTrigger className="h-7 w-auto border-0 p-0">
                              <Badge className={
                                o.status === "Accepted" ? "bg-success text-success-foreground" :
                                o.status === "Declined" ? "bg-destructive text-destructive-foreground" :
                                "bg-warning/10 text-warning"
                              }>{o.status}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {OFFER_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(o.offered_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
