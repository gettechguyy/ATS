import { useState, useRef } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
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
import { fetchSubmissionById, updateSubmission } from "../../dbscripts/functions/submissions";
import { getStateName, US_STATES } from "@/lib/usStates";
import {
  fetchInterviewsBySubmission,
  createInterview as createInterviewFn,
  updateInterviewStatus as updateInterviewStatusFn,
  updateInterviewFeedback as updateInterviewFeedbackFn,
  rescheduleInterview as rescheduleInterviewFn,
} from "../../dbscripts/functions/interviews";
import { uploadInterviewQuestions, uploadVendorJobDescription, uploadScreenCallFile } from "../../dbscripts/functions/storage";
import { updateSubmissionStatus } from "../../dbscripts/functions/submissions";
import { fetchRescheduleLogsByInterviewIds } from "../../dbscripts/functions/rescheduleLogs";
import {
  fetchOffersBySubmission,
  createOffer as createOfferFn,
  updateOfferStatus as updateOfferStatusFn,
} from "../../dbscripts/functions/offers";
import { updateCandidateStatus } from "../../dbscripts/functions/candidates";
import { formatInAppDateTime } from "@/lib/appTimezone";

const INTERVIEW_STATUSES = ["Scheduled", "Passed", "Rejected", "Rescheduled"] as const;
const INTERVIEW_MODES = ["Virtual", "Onsite", "Phone"] as const;
const OFFER_STATUSES = ["Pending", "Accepted", "Declined"] as const;

const SUBMISSION_STATUSES = ["Applied", "Vendor Responded", "Screen Call", "Interview", "Rejected", "Offered"] as const;

const statusColors: Record<string, string> = {
  Applied: "bg-secondary text-secondary-foreground",
  "Screen Call": "bg-info/10 text-info",
  Interview: "bg-warning/10 text-warning",
  Rejected: "bg-destructive/10 text-destructive",
  Offered: "bg-success/10 text-success",
  "Vendor Responded": "bg-info/10 text-info",
};

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isCandidate } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleInterviewId, setRescheduleInterviewId] = useState<string | null>(null);
  const [screenResponseLocal, setScreenResponseLocal] = useState<"None" | "Yes" | "No" | null>(null);
  const [screenRejectionLocal, setScreenRejectionLocal] = useState<string | null>(null);

  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorSubmission, setVendorSubmission] = useState<any | null>(null);
  const [wfRate, setWfRate] = useState<number | "">("");
  const [wfRateType, setWfRateType] = useState<"W2" | "C2C" | "1099">("W2");
  const [wfJobDescription, setWfJobDescription] = useState("");
  const [wfJobType, setWfJobType] = useState<"Remote" | "Hybrid" | "On-site">("Remote");
  const [wfCity, setWfCity] = useState("");
  const [wfState, setWfState] = useState("");
  const [wfVendorJobDescUrl, setWfVendorJobDescUrl] = useState<string | null>(null);
  const [wfVendorUploading, setWfVendorUploading] = useState(false);
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);
  const [screenSubmission, setScreenSubmission] = useState<any | null>(null);
  const [screenDate, setScreenDate] = useState("");
  const [screenTime, setScreenTime] = useState("");
  const [screenMode, setScreenMode] = useState<"Virtual" | "Phone">("Virtual");
  const [screenLinkOrPhone, setScreenLinkOrPhone] = useState("");
  const [screenResumeUrl, setScreenResumeUrl] = useState<string | null>(null);
  const [screenQuestionsUrl, setScreenQuestionsUrl] = useState<string | null>(null);
  const [screenResponse, setScreenResponse] = useState<"None" | "Yes" | "No">("None");
  const [screenRejectionNote, setScreenRejectionNote] = useState("");
  const pendingScreenAfterVendorRef = useRef<any | null>(null);

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
      const file = fd.get("interview_questions") as File | null;
      if (!file || (file as any).size === 0) {
        throw new Error("Interview questions file is required");
      }
      // upload file to storage
      const url = await uploadInterviewQuestions(id!, file as File);
      await createInterviewFn({
        submission_id: id!,
        candidate_id: submission!.candidate_id,
        created_by: submission!.recruiter_id ?? null,
        round_number: nextRound,
        mode,
        scheduled_at: `${fd.get("date")}T${fd.get("time")}:00`,
        virtual_link: mode === "Virtual" ? (fd.get("virtual_link") as string) || null : null,
        interview_questions_url: url,
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

  

  const createOffer = useMutation({
    mutationFn: async (payload: { salary: number; job_description?: string | null; job_description_url?: string | null; tentative_start_date?: string | null; additional_notes?: string | null }) => {
      await createOfferFn({
        submission_id: id!,
        candidate_id: submission!.candidate_id,
        created_by: submission!.recruiter_id ?? null,
        salary: payload.salary,
        job_description: payload.job_description ?? null,
        job_description_url: payload.job_description_url ?? null,
        tentative_start_date: payload.tentative_start_date ?? null,
        additional_notes: payload.additional_notes ?? null,
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
        queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
        queryClient.invalidateQueries({ queryKey: ["submissions-screens"] });
        queryClient.invalidateQueries({ queryKey: ["application-summaries"] });
        queryClient.invalidateQueries({ queryKey: ["candidate-submissions-sheet"] });
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

  const updateStatus = useMutation({
    mutationFn: async ({ sid, status }: { sid: string; status: string }) => {
      await updateSubmissionStatus(sid, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-screens"] });
      queryClient.invalidateQueries({ queryKey: ["application-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-submissions-sheet"] });
      toast.success("Status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetScreenDialogFields = () => {
    setScreenDate("");
    setScreenTime("");
    setScreenLinkOrPhone("");
    setScreenResumeUrl(null);
    setScreenQuestionsUrl(null);
    setScreenResponse("None");
    setScreenRejectionNote("");
  };

  const handleSubmissionStatusChange = (v: string) => {
    if (!submission) return;
    const s = submission;
    if (v === "Vendor Responded") {
      pendingScreenAfterVendorRef.current = null;
      setVendorSubmission(s);
      setWfRate(s.rate != null ? Number(s.rate) : "");
      setWfRateType((s.rate_type as any) || "W2");
      setWfJobDescription(s.job_description || "");
      setWfJobType((s.job_type as "Remote" | "Hybrid" | "On-site") || "Remote");
      setWfCity(s.city || "");
      setWfState(s.state || "");
      setWfVendorJobDescUrl(s.job_description_url || null);
      setVendorDialogOpen(true);
      return;
    }
    if (v === "Screen Call") {
      if (s.status === "Applied") {
        pendingScreenAfterVendorRef.current = s;
        setVendorSubmission(s);
        setWfRate(s.rate != null ? Number(s.rate) : "");
        setWfRateType((s.rate_type as any) || "W2");
        setWfJobDescription(s.job_description || "");
        setWfJobType((s.job_type as "Remote" | "Hybrid" | "On-site") || "Remote");
        setWfCity(s.city || "");
        setWfState(s.state || "");
        setWfVendorJobDescUrl(s.job_description_url || null);
        setVendorDialogOpen(true);
        return;
      }
      setScreenSubmission(s);
      resetScreenDialogFields();
      setScreenDialogOpen(true);
      return;
    }
    if (v === "Interview") {
      if (!s.screen_scheduled_at) {
        toast.info("Schedule a screen call (date, time, and required uploads) before moving to Interview.");
        setScreenSubmission(s);
        resetScreenDialogFields();
        setScreenDialogOpen(true);
        return;
      }
      updateStatus.mutate({ sid: s.id, status: v });
      return;
    }
    updateStatus.mutate({ sid: s.id, status: v });
  };

  const updateSubmissionMutation = useMutation({
    mutationFn: async ({ id: sid, payload }: { id: string; payload: any }) => {
      await updateSubmission(sid, payload);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-screens"] });
      queryClient.invalidateQueries({ queryKey: ["application-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-submissions-sheet"] });
      toast.success("Saved");
      setVendorDialogOpen(false);
      setVendorSubmission(null);
      setWfRate("");
      setWfJobDescription("");
      setWfJobType("Remote");
      setWfCity("");
      setWfState("");
      setWfVendorJobDescUrl(null);
      const pending = pendingScreenAfterVendorRef.current;
      if (
        pending &&
        pending.id === variables.id &&
        variables.payload?.status === "Vendor Responded"
      ) {
        pendingScreenAfterVendorRef.current = null;
        setScreenSubmission(pending);
        resetScreenDialogFields();
        setScreenDialogOpen(true);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleWfVendorJobUpload = async (submissionId: string, file: File) => {
    setWfVendorUploading(true);
    try {
      const publicUrl = await uploadVendorJobDescription(submissionId, file);
      setWfVendorJobDescUrl(publicUrl);
      await updateSubmission(submissionId, { job_description_url: publicUrl });
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      toast.success("Job description uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setWfVendorUploading(false);
    }
  };

  const handleScreenFileUpload = async (submissionId: string, file: File, folder?: "resume" | "questions") => {
    try {
      const publicUrl = await uploadScreenCallFile(submissionId, file, folder);
      if (folder === "questions") setScreenQuestionsUrl(publicUrl);
      else setScreenResumeUrl(publicUrl);
      toast.success("Uploaded");
      const payload: any = {};
      if (folder === "questions") payload.screen_questions_url = publicUrl;
      else payload.screen_resume_url = publicUrl;
      await updateSubmission(submissionId, payload);
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-screens"] });
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!submission) {
    return <div className="py-12 text-center text-muted-foreground">Application not found</div>;
  }

  const canCreateInterview = submission.status === "Interview" || submission.status === "Screen Call";
  const canCreateOffer = submission.status === "Offered";

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => {
          // Go back to the exact page the user came from (e.g., Submissions sheet, Screens).
          navigate(-1);
        }}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">{submission.position}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Client:</span> {submission.client_name}</div>
            <div><span className="text-muted-foreground">Portal:</span> {(submission as any).job_portal || "—"}</div>
            {(submission as any).job_link && (
              <div>
                <span className="text-muted-foreground">Job Link:</span>{" "}
                <a href={(submission as any).job_link} target="_blank" rel="noreferrer" className="ml-2 text-xs text-info underline">Click Here</a>
              </div>
            )}
            <div><span className="text-muted-foreground">Candidate:</span> {(submission as any).candidates?.first_name} {(submission as any).candidates?.last_name || ""}</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              {!isCandidate ? (
                <Select value={submission.status} onValueChange={handleSubmissionStatusChange}>
                  <SelectTrigger className="h-auto min-h-0 w-auto max-w-full border-0 p-0">
                    <Badge className={statusColors[submission.status] ?? ""} variant="outline">{submission.status}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={statusColors[submission.status] ?? ""} variant="outline">{submission.status}</Badge>
              )}
            </div>
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
                <div><span className="text-muted-foreground">Scheduled:</span> {formatInAppDateTime(submission.screen_scheduled_at)}</div>
                <div><span className="text-muted-foreground">Mode:</span> {submission.screen_mode || "—"}</div>
                {submission.screen_link_or_phone && (
                  <div>
                    <span className="text-muted-foreground">{submission.screen_mode === "Virtual" ? "Link" : "Phone"}:</span>{" "}
                    {submission.screen_mode === "Virtual" ? (
                      <a href={submission.screen_link_or_phone} target="_blank" rel="noreferrer" className="ml-2 text-xs text-info underline">Click Here</a>
                    ) : (
                      <span className="ml-2">{submission.screen_link_or_phone}</span>
                    )}
                  </div>
                )}
                <div><span className="text-muted-foreground">Resume (Screen Call):</span> {submission.screen_resume_url ? <a href={submission.screen_resume_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-info underline">View</a> : "—"}</div>
                <div><span className="text-muted-foreground">Interview Questions:</span> {submission.screen_questions_url ? <a href={submission.screen_questions_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-info underline">View</a> : "—"}</div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">Screen Response:</span>
                  <Select value={screenResponseLocal ?? (submission.screen_response_status ?? "None")} onValueChange={(v) => setScreenResponseLocal(v as any)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="ml-2">
                    <Input placeholder="Rejection note (if No)" value={screenRejectionLocal ?? (submission.screen_rejection_note ?? "")} onChange={(e) => setScreenRejectionLocal(e.target.value)} disabled={(screenResponseLocal ?? submission.screen_response_status ?? "None") !== "No"} />
                  </div>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const newStatus = screenResponseLocal ?? (submission.screen_response_status ?? "None");
                    const payload: any = { screen_response_status: newStatus === "None" ? null : newStatus };
                    if (newStatus === "No") payload.screen_rejection_note = screenRejectionLocal ?? submission.screen_rejection_note ?? null;
                    else payload.screen_rejection_note = null;
                    if (newStatus === "Yes") payload.screen_next_step = "Interview";
                    else payload.screen_next_step = null;
                    try {
                      await updateSubmissionMutation.mutateAsync({ id: submission.id, payload });
                    } catch {
                      /* handled by mutation onError */
                    }
                  }}>Save</Button>
                </div>
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
              {/* Only allow non-candidate users to schedule interviews */}
              { !isCandidate ? (
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
                      const file = fd.get("interview_questions") as File | null;
                      if (!date || !time) {
                        toast.error("Date and time are required");
                        return;
                      }
                      if (!mode) {
                        toast.error("Mode is required");
                        return;
                      }
                      if (!file || (file as any).size === 0) {
                        toast.error("Interview questions file is required");
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
                    <div className="space-y-2">
                      <Label>Interview Questions (upload) *</Label>
                      <Input name="interview_questions" type="file" accept=".pdf,.doc,.docx,.txt" required />
                    </div>
                    <Button type="submit" className="w-full" disabled={createInterview.isPending}>
                      Schedule Interview
                    </Button>
                  </form>
                  </DialogContent>
                </Dialog>
              ) : null}
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
                        {canCreateInterview ? "No interviews scheduled" : "Change application status to 'Interview' or 'Screen Call' to schedule"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    interviews?.map((iv: any) => (
                      <TableRow key={iv.id}>
                        <TableCell className="font-medium">Round {iv.round_number}</TableCell>
                        <TableCell>{formatInAppDateTime(iv.scheduled_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{iv.mode}</Badge>
                          {iv.mode === "Virtual" && iv.virtual_link && (
                            <a href={iv.virtual_link} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-info underline">Join</a>
                          )}
                        </TableCell>
                        <TableCell>
                          {isCandidate ? (
                            <Badge variant="secondary">{iv.status}</Badge>
                          ) : (
                            <Select value={iv.status} onValueChange={async (v) => {
                              try {
                                await updateInterviewStatus.mutateAsync({ interviewId: iv.id, status: v });
                                if (v === "Passed") setOfferDialogOpen(true);
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
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!isCandidate && (
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
                            )}
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
                        <TableCell className="text-muted-foreground">{formatInAppDateTime(log.old_date)}</TableCell>
                        <TableCell>{formatInAppDateTime(log.new_date)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatInAppDateTime(log.changed_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Offers */}
          {offers && offers.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-4 w-4" /> Offers ({offers?.length || 0})
              </CardTitle>
              {/* Only allow non-candidate users to create offers */}
              { !isCandidate ? (
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
                      if (!salary || salary <= 0) {
                        toast.error("Please enter a valid salary");
                        return;
                      }
                      const tentative = (fd.get("tentative_start_date") as string) || null;
                      const notes = (fd.get("additional_notes") as string) || null;
                      await createOffer.mutateAsync({ salary, tentative_start_date: tentative, additional_notes: notes });
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Salary *</Label>
                        <Input name="salary" type="number" required placeholder="120000" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tentative Start Date</Label>
                          <Input name="tentative_start_date" type="date" />
                        </div>
                        <div className="space-y-2">
                          <Label>Additional Notes</Label>
                          <Textarea name="additional_notes" />
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={createOffer.isPending}>
                        Create Offer
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Offered</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {offers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        {canCreateOffer ? "No offers yet" : "Change application status to 'Offered' to create offers"}
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
                        <TableCell>{o.tentative_start_date ? new Date(o.tentative_start_date).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="whitespace-pre-wrap">{o.additional_notes || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(o.offered_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      <Dialog
        open={vendorDialogOpen}
        onOpenChange={(open) => {
          setVendorDialogOpen(open);
          if (!open) pendingScreenAfterVendorRef.current = null;
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vendor Responded Details</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!vendorSubmission) return;
              if (wfRate === "" || isNaN(Number(wfRate))) {
                toast.error("Please enter a valid Rate");
                return;
              }
              if ((!wfJobDescription || wfJobDescription.trim() === "") && !wfVendorJobDescUrl) {
                toast.error("Please enter the Job Description or upload a document");
                return;
              }
              if (!wfJobType) {
                toast.error("Please select the Job Type");
                return;
              }
              if (wfJobType !== "Remote" && (!wfCity.trim() || !wfState)) {
                toast.error("Please provide City and State for non-Remote jobs");
                return;
              }
              const payload: any = {
                status: "Vendor Responded",
                rate: Number(wfRate),
                rate_type: wfRateType,
                job_description: wfJobDescription || null,
                job_description_url: wfVendorJobDescUrl ?? null,
                job_type: wfJobType,
                city: wfJobType !== "Remote" ? wfCity : null,
                state: wfJobType !== "Remote" ? wfState : null,
              };
              updateSubmissionMutation.mutate({ id: vendorSubmission.id, payload });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rate (USD)</Label>
                <Input
                  required
                  type="number"
                  value={wfRate === "" ? "" : wfRate}
                  onChange={(e) => setWfRate(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Rate Type</Label>
                <Select value={wfRateType} onValueChange={(v) => setWfRateType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="W2">W2</SelectItem>
                    <SelectItem value="C2C">C2C</SelectItem>
                    <SelectItem value="1099">1099</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Job Description</Label>
              <Textarea value={wfJobDescription} onChange={(e) => setWfJobDescription(e.target.value)} />
              <div className="mt-2">
                <Label>Or upload Job Description document</Label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (!f || !vendorSubmission) return;
                    handleWfVendorJobUpload(vendorSubmission.id, f);
                  }}
                />
                {wfVendorUploading && <div className="text-xs">Uploading...</div>}
                {wfVendorJobDescUrl && (
                  <a href={wfVendorJobDescUrl} target="_blank" rel="noreferrer" className="text-xs text-info underline">
                    View uploaded doc
                  </a>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Type</Label>
                <Select value={wfJobType} onValueChange={(v) => setWfJobType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Remote">Remote</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                    <SelectItem value="On-site">On-site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {wfJobType !== "Remote" && (
                <>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input required value={wfCity} onChange={(e) => setWfCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Select value={wfState} onValueChange={(v) => setWfState(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((st) => (
                          <SelectItem key={st.code} value={st.code}>
                            {st.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={updateSubmissionMutation.isPending}>
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={screenDialogOpen} onOpenChange={setScreenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Screen Call</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!screenSubmission) return;
              if (!screenDate || !screenTime) {
                toast.error("Please select date and time");
                return;
              }
              if (screenMode === "Virtual") {
                if (!screenLinkOrPhone?.trim()) {
                  toast.error("Please provide meeting link for Virtual mode");
                  return;
                }
                try {
                  new URL(screenLinkOrPhone);
                } catch {
                  toast.error("Please enter a valid meeting link (include https://)");
                  return;
                }
              }
              if (screenMode === "Phone") {
                if (!screenLinkOrPhone?.trim()) {
                  toast.error("Please provide phone number for Phone mode");
                  return;
                }
                if (!/^\+?[0-9\-\s()]{7,}$/.test(screenLinkOrPhone.trim())) {
                  toast.error("Please enter a valid phone number");
                  return;
                }
              }
              if (!screenResumeUrl) {
                toast.error("Please upload the resume for the screen call");
                return;
              }
              if (!screenQuestionsUrl) {
                toast.error("Please upload the interview questions document");
                return;
              }
              const scheduled_at = `${screenDate}T${screenTime}:00`;
              const payload: any = {
                status: "Screen Call",
                screen_scheduled_at: scheduled_at,
                screen_mode: screenMode,
                screen_link_or_phone: screenLinkOrPhone,
                screen_resume_url: screenResumeUrl,
                screen_questions_url: screenQuestionsUrl,
                screen_response_status: screenResponse === "None" ? null : screenResponse,
                screen_rejection_note: screenResponse === "No" ? screenRejectionNote || null : null,
                screen_next_step: screenResponse === "Yes" ? "Interview" : null,
              };
              await updateSubmissionMutation.mutateAsync({ id: screenSubmission.id, payload });
              setScreenDialogOpen(false);
              setScreenSubmission(null);
              resetScreenDialogFields();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={screenDate} onChange={(e) => setScreenDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Input type="time" value={screenTime} onChange={(e) => setScreenTime(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mode *</Label>
              <Select value={screenMode} onValueChange={(v) => setScreenMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{screenMode === "Virtual" ? "Meeting Link *" : "Phone Number *"}</Label>
              <Input value={screenLinkOrPhone} onChange={(e) => setScreenLinkOrPhone(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Upload Resume (Screen Call)</Label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (!f || !screenSubmission) return;
                    handleScreenFileUpload(screenSubmission.id, f, "resume");
                  }}
                />
                {screenResumeUrl && (
                  <a href={screenResumeUrl} target="_blank" rel="noreferrer" className="text-xs text-info underline">
                    View
                  </a>
                )}
              </div>
              <div className="space-y-2">
                <Label>Upload Interview Questions Doc</Label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (!f || !screenSubmission) return;
                    handleScreenFileUpload(screenSubmission.id, f, "questions");
                  }}
                />
                {screenQuestionsUrl && (
                  <a href={screenQuestionsUrl} target="_blank" rel="noreferrer" className="text-xs text-info underline">
                    View
                  </a>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Screen Response</Label>
                <Select value={screenResponse} onValueChange={(v) => setScreenResponse(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rejection Note (if Rejected)</Label>
                <Input
                  value={screenRejectionNote}
                  onChange={(e) => setScreenRejectionNote(e.target.value)}
                  placeholder="Rejection note"
                  disabled={screenResponse !== "No"}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={updateSubmissionMutation.isPending}>
              Save Screen Call
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
