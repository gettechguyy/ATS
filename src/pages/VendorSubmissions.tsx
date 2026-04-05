import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import {
  createSubmission as createSubmissionFn,
  updateSubmissionStatus,
  fetchSpecialSubmissionsPage,
  type SpecialSubmissionsRoleContext,
} from "../../dbscripts/functions/submissions";
import { fetchCandidates, fetchCandidatesByRecruiter, fetchCandidatesBasic } from "../../dbscripts/functions/candidates";
import { uploadAssessmentAttachment, uploadVendorJobDescription, uploadScreenCallFile } from "../../dbscripts/functions/storage";
import { updateSubmission } from "../../dbscripts/functions/submissions";
import { US_STATES } from "@/lib/usStates";

const PAGE_SIZE = 10;
const SUBMISSION_STATUSES = ["Applied", "Vendor Responded", "Assessment", "Screen Call", "Interview", "Rejected", "Offered"] as const;

const statusColors: Record<string, string> = {
  Applied: "bg-secondary text-secondary-foreground",
  Assessment: "bg-primary/10 text-primary",
  "Screen Call": "bg-info/10 text-info",
  Interview: "bg-warning/10 text-warning",
  Rejected: "bg-destructive/10 text-destructive",
  Offered: "bg-success/10 text-success",
  "Vendor Responded": "bg-info/10 text-info",
};

export default function VendorSubmissions() {
  const { user, profile, isCandidate, isRecruiter, isAdmin, isManager, isTeamLead, isAgencyAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [candidateFilter, setCandidateFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCandidateId, setNewCandidateId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [rate, setRate] = useState<string>("");
  const [rateType, setRateType] = useState<"W2" | "C2C" | "1099">("W2");
  const [jobDescription, setJobDescription] = useState("");
  const [jobType, setJobType] = useState<"Remote" | "Hybrid" | "On-site">("Remote");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [jobDescFile, setJobDescFile] = useState<File | null>(null);
  const [jobDescUploading, setJobDescUploading] = useState(false);

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
  const pendingAssessmentAfterVendorRef = useRef<any | null>(null);

  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [assessmentSubmission, setAssessmentSubmission] = useState<any | null>(null);
  const [assessmentEndDate, setAssessmentEndDate] = useState("");
  const [assessmentLink, setAssessmentLink] = useState("");
  const [assessmentAttachmentUrl, setAssessmentAttachmentUrl] = useState<string | null>(null);
  const [assessmentFile, setAssessmentFile] = useState<File | null>(null);
  const [assessmentUploading, setAssessmentUploading] = useState(false);

  const vendorPageContext = useMemo((): SpecialSubmissionsRoleContext | null => {
    if (isCandidate && profile?.linked_candidate_id) {
      return { role: "candidate", linkedCandidateId: profile.linked_candidate_id };
    }
    if (isAgencyAdmin && profile?.agency_id) return { role: "agency", agencyId: profile.agency_id };
    if (isRecruiter && user?.id) return { role: "recruiter", recruiterId: user.id };
    if (isTeamLead && profile?.id) return { role: "team_lead", teamLeadProfileId: profile.id };
    if (isAdmin || isManager) return { role: "admin" };
    return null;
  }, [
    isCandidate,
    profile?.linked_candidate_id,
    profile?.agency_id,
    profile?.id,
    isAgencyAdmin,
    isRecruiter,
    user?.id,
    isTeamLead,
    isAdmin,
    isManager,
  ]);

  const vendorPageEnabled =
    vendorPageContext != null &&
    (isCandidate ? !!profile?.linked_candidate_id
    : isRecruiter ? !!user?.id
    : isAgencyAdmin ? !!profile?.agency_id
    : isTeamLead ? !!profile?.id
    : true);

  const { data: vendorPage, isLoading } = useQuery({
    queryKey: [
      "submissions-vendor-responded",
      vendorPageContext,
      page,
      search,
      candidateFilter,
    ],
    queryFn: () =>
      fetchSpecialSubmissionsPage("vendor_responded", vendorPageContext!, {
        page,
        pageSize: PAGE_SIZE,
        search,
        sortBy: "created_at",
        order: "desc",
        candidateId:
          !isCandidate && candidateFilter !== "all" ? candidateFilter : null,
      }),
    enabled: vendorPageEnabled,
  });

  const paginated = vendorPage?.data ?? [];
  const totalCount = vendorPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Candidate dropdown for Add Vendor Submission (admin: all, recruiter: own)
  const candidatesQueryFn = async () => {
    if (isAdmin || isManager) return fetchCandidates();
    if (isRecruiter && user?.id) return fetchCandidatesByRecruiter(user.id);
    if (isAgencyAdmin && profile?.agency_id) return fetchCandidatesBasic(profile.agency_id);
    return [];
  };

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["vendor-submissions-candidates", user?.id],
    queryFn: candidatesQueryFn,
    enabled: isAdmin || isManager || (isRecruiter && !!user?.id) || (isAgencyAdmin && !!profile?.agency_id),
  });

  const createSubmission = useMutation({
    mutationFn: async () => {
      if (!newCandidateId || !user?.id) throw new Error("Candidate and recruiter are required");
      if (!rate || isNaN(Number(rate))) throw new Error("Valid rate is required");
      if (!jobDescription.trim() && !jobDescFile) throw new Error("Please enter Job Description or upload a document");
      if (!jobType) throw new Error("Job Type is required");
      if (jobType !== "Remote" && (!city.trim() || !stateValue)) {
        throw new Error("City and State are required for non-Remote jobs");
      }
      // 1) Create the submission row (may or may not have text description)
      const created = await createSubmissionFn({
        candidate_id: newCandidateId,
        recruiter_id: user.id,
        client_name: newClientName,
        position: newPosition,
        status: "Vendor Responded",
        rate: Number(rate),
        rate_type: rateType,
        job_description: jobDescription || null,
        job_type: jobType,
        city: jobType === "Remote" ? null : city,
        state: jobType === "Remote" ? null : stateValue,
      });
      // 2) If a file was chosen, upload it and persist URL
      if (jobDescFile && created && (created as any).id) {
        const submissionId = (created as any).id as string;
        setJobDescUploading(true);
        try {
          const publicUrl = await uploadVendorJobDescription(submissionId, jobDescFile);
          await updateSubmission(submissionId, { job_description_url: publicUrl });
        } finally {
          setJobDescUploading(false);
        }
      }
    },
    onSuccess: () => {
      toast.success("Submission created with Vendor Responded status");
      setAddDialogOpen(false);
      setNewCandidateId(null);
      setNewClientName("");
      setNewPosition("");
      setRate("");
      setJobDescription("");
      setJobType("Remote");
      setCity("");
      setStateValue("");
      queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await updateSubmissionStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-assessments"] });
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

  const handleSubmissionStatusChange = (s: any, v: string) => {
    if (v === "Vendor Responded") {
      pendingScreenAfterVendorRef.current = null;
      pendingAssessmentAfterVendorRef.current = null;
      setVendorSubmission(s);
      setWfRate(s.rate != null ? Number(s.rate) : "");
      setWfRateType((s.rate_type as any) || "W2");
      setWfJobDescription(s.job_description || "");
      setWfJobType(s.job_type || "Remote");
      setWfCity(s.city || "");
      setWfState(s.state || "");
      setWfVendorJobDescUrl(s.job_description_url || null);
      setVendorDialogOpen(true);
      return;
    }
    if (v === "Assessment") {
      if (s.status === "Applied") {
        pendingAssessmentAfterVendorRef.current = s;
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
      setAssessmentSubmission(s);
      setAssessmentEndDate(s.assessment_end_date ? String(s.assessment_end_date).slice(0, 10) : "");
      setAssessmentLink(s.assessment_link || "");
      setAssessmentAttachmentUrl(s.assessment_attachment_url || null);
      setAssessmentFile(null);
      setAssessmentDialogOpen(true);
      return;
    }
    if (v === "Screen Call") {
      if (s.status === "Applied") {
        pendingScreenAfterVendorRef.current = s;
        pendingAssessmentAfterVendorRef.current = null;
        setVendorSubmission(s);
        setWfRate(s.rate != null ? Number(s.rate) : "");
        setWfRateType((s.rate_type as any) || "W2");
        setWfJobDescription(s.job_description || "");
        setWfJobType(s.job_type || "Remote");
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
      updateStatus.mutate({ id: s.id, status: v });
      return;
    }
    updateStatus.mutate({ id: s.id, status: v });
  };

  const updateSubmissionMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      await updateSubmission(id, payload);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-screens"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["application-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-assessments"] });
      toast.success("Submission updated");
      setVendorDialogOpen(false);
      setVendorSubmission(null);
      setWfRate("");
      setWfJobDescription("");
      setWfJobType("Remote");
      setWfCity("");
      setWfState("");
      setWfVendorJobDescUrl(null);
      const pendingScreen = pendingScreenAfterVendorRef.current;
      if (
        pendingScreen &&
        pendingScreen.id === variables.id &&
        variables.payload?.status === "Vendor Responded"
      ) {
        pendingScreenAfterVendorRef.current = null;
        setScreenSubmission(pendingScreen);
        resetScreenDialogFields();
        setScreenDialogOpen(true);
      }
      const pendingAssessment = pendingAssessmentAfterVendorRef.current;
      if (
        pendingAssessment &&
        pendingAssessment.id === variables.id &&
        variables.payload?.status === "Vendor Responded"
      ) {
        pendingAssessmentAfterVendorRef.current = null;
        setAssessmentSubmission(pendingAssessment);
        setAssessmentEndDate(pendingAssessment.assessment_end_date ? String(pendingAssessment.assessment_end_date).slice(0, 10) : "");
        setAssessmentLink(pendingAssessment.assessment_link || "");
        setAssessmentAttachmentUrl(pendingAssessment.assessment_attachment_url || null);
        setAssessmentFile(null);
        setAssessmentDialogOpen(true);
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
      queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, candidateFilter]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Submission</h1>
            <p className="text-sm text-muted-foreground">
              Vendor responses, screen calls, and submissions with a scheduled screen
            </p>
          </div>
          {(isAdmin || isRecruiter) && (
            <Button
              size="sm"
              onClick={() => {
                if (candidatesLoading) {
                  toast.error("Loading candidates, please wait");
                  return;
                }
                if (!candidates || candidates.length === 0) {
                  toast.error("No candidates available to create a submission.");
                  return;
                }
                setAddDialogOpen(true);
              }}
              disabled={candidatesLoading || !candidates || candidates.length === 0}
            >
              Add
            </Button>
          )}
        </div>

        {!isCandidate && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search submissions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="min-w-[220px]">
              <Select value={candidateFilter} onValueChange={setCandidateFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All candidates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All candidates</SelectItem>
                  {(candidates || []).filter((c: any) => c && c.id).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.first_name} {c.last_name || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {!isCandidate && <TableHead>Candidate</TableHead>}
                <TableHead>Client</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Loading submissions...</TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No submissions match your filters</TableCell>
                </TableRow>
              ) : (
                paginated.map((s: any) => (
                  <TableRow key={s.id}>
                    {!isCandidate && (
                      <TableCell className="font-medium">
                        {s.candidates?.first_name} {s.candidates?.last_name || ""}
                      </TableCell>
                    )}
                    <TableCell>{s.client_name}</TableCell>
                    <TableCell>{s.position}</TableCell>
                    <TableCell>
                      <Select
                        value={s.status}
                        onValueChange={(v) => handleSubmissionStatusChange(s, v)}
                      >
                        <SelectTrigger className="h-8 w-[160px]">
                          <Badge className={statusColors[s.status] || ""}>{s.status}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {SUBMISSION_STATUSES.map((st) => (
                            <SelectItem key={st} value={st}>
                              {st}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/submissions/${s.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!isLoading && totalCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Vendor Responded Submission Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Vendor Responded Submission</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCandidateId) {
                toast.error("Please select a candidate");
                return;
              }
              if (!newClientName.trim() || !newPosition.trim()) {
                toast.error("Client and Position are required");
                return;
              }
              if (!rate || isNaN(Number(rate))) {
                toast.error("Please enter a valid Rate");
                return;
              }
              if (!jobDescription.trim() && !jobDescFile) {
                toast.error("Please enter Job Description or upload a document");
                return;
              }
              if (jobType !== "Remote" && (!city.trim() || !stateValue)) {
                toast.error("Please provide City and State for non-Remote jobs");
                return;
              }
              createSubmission.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Candidate</Label>
              <Select
                value={newCandidateId ?? undefined}
                onValueChange={(v) => setNewCandidateId(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {(candidates || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.first_name} {c.last_name || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Position *</Label>
                <Input
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rate (USD) *</Label>
                <Input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Rate Type *</Label>
                <Select value={rateType} onValueChange={(v) => setRateType(v as any)}>
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
              <Input
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste or type vendor job description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Type *</Label>
                <Select value={jobType} onValueChange={(v) => setJobType(v as any)}>
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
              {jobType !== "Remote" && (
                <>
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Input
                      value={stateValue}
                      onChange={(e) => setStateValue(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>Or upload Job Description document</Label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(ev) => {
                  const f = ev.target.files?.[0] ?? null;
                  setJobDescFile(f);
                }}
              />
              {jobDescUploading && (
                <p className="text-xs text-muted-foreground">Uploading...</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createSubmission.isPending}
            >
              {createSubmission.isPending ? "Saving..." : "Add Submission"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={vendorDialogOpen}
        onOpenChange={(open) => {
          setVendorDialogOpen(open);
          if (!open) {
            pendingScreenAfterVendorRef.current = null;
            pendingAssessmentAfterVendorRef.current = null;
          }
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

      <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assessment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!assessmentSubmission) return;
              if (!assessmentEndDate) {
                toast.error("Assessment end date is required");
                return;
              }
              const linkTrim = assessmentLink.trim();
              if (!linkTrim && !assessmentFile && !assessmentAttachmentUrl) {
                toast.error("Provide an assessment link or upload a file");
                return;
              }
              setAssessmentUploading(true);
              try {
                let attachmentUrl = assessmentAttachmentUrl;
                if (assessmentFile) {
                  attachmentUrl = await uploadAssessmentAttachment(assessmentSubmission.id, assessmentFile);
                }
                await updateSubmissionMutation.mutateAsync({
                  id: assessmentSubmission.id,
                  payload: {
                    status: "Assessment",
                    assessment_end_date: assessmentEndDate,
                    assessment_link: linkTrim || null,
                    assessment_attachment_url: attachmentUrl || null,
                  },
                });
                setAssessmentDialogOpen(false);
                setAssessmentSubmission(null);
                setAssessmentEndDate("");
                setAssessmentLink("");
                setAssessmentAttachmentUrl(null);
                setAssessmentFile(null);
              } catch (err: any) {
                toast.error(err?.message || "Failed to save assessment");
              } finally {
                setAssessmentUploading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Assessment end date *</Label>
              <Input type="date" value={assessmentEndDate} onChange={(e) => setAssessmentEndDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Assessment link (optional if you upload a file)</Label>
              <Input
                type="url"
                value={assessmentLink}
                onChange={(e) => setAssessmentLink(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Upload assessment file (optional if you provide a link)</Label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(ev) => setAssessmentFile(ev.target.files?.[0] ?? null)}
              />
              {assessmentFile && <p className="text-xs text-muted-foreground">Selected: {assessmentFile.name}</p>}
              {assessmentAttachmentUrl && !assessmentFile && (
                <div className="flex flex-wrap items-center gap-2">
                  <a href={assessmentAttachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-info underline">
                    Current file
                  </a>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAssessmentAttachmentUrl(null)}>
                    Remove attachment
                  </Button>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={updateSubmissionMutation.isPending || assessmentUploading}>
              {assessmentUploading ? "Saving…" : "Save Assessment"}
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

