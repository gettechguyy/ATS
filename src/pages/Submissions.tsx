import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
 
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Eye, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchSubmissionsByCandidatePaginated,
  updateSubmissionStatus,
  updateSubmission,
  createSubmission as createSubmissionFn,
  fetchCandidateApplicationSummaries,
  fetchSubmissionsByCandidateWithDetails,
  type ApplicationSummariesContext,
} from "../../dbscripts/functions/submissions";
import { fetchCandidates, fetchCandidatesByRecruiter, fetchCandidatesBasic, fetchCandidatesByTeamLead } from "../../dbscripts/functions/candidates";
import { fetchAgencies } from "../../dbscripts/functions/agencies";
import { fetchProfilesByRole } from "../../dbscripts/functions/profiles";
import { uploadAssessmentAttachment, uploadScreenCallFile, uploadVendorJobDescription } from "../../dbscripts/functions/storage";
import { US_STATES } from "@/lib/usStates";
import {
  submissionHasAssessmentDetails,
  submissionHasScheduledScreen,
  submissionHasVendorDetails,
  submissionShouldPromptAssessmentBeforeScreen,
} from "@/lib/submissionStatusWorkflow";

const PAGE_SIZE = 10;
const CANDIDATES_PAGE_SIZE = 10; // candidates per page in main table (non-candidate view)
const APPLICATIONS_SHEET_PAGE_SIZE = 10;
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

export default function Submissions() {
  const { user, profile, role, isCandidate, isRecruiter, isAdmin, isManager, isTeamLead, isAgencyAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorSubmission, setVendorSubmission] = useState<any | null>(null);
  const [rate, setRate] = useState<number | "">("");
  const [rateType, setRateType] = useState<"W2" | "C2C" | "1099">("W2");
  const [jobDescription, setJobDescription] = useState("");
  const [jobType, setJobType] = useState<"Remote" | "Hybrid" | "On-site">("Remote");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [screenDialogOpen, setScreenDialogOpen] = useState(false);
  const [screenSubmission, setScreenSubmission] = useState<any | null>(null);
  const [screenDate, setScreenDate] = useState<string>("");
  const [screenTime, setScreenTime] = useState<string>("");
  const [screenMode, setScreenMode] = useState<"Virtual" | "Phone">("Virtual");
  const [screenLinkOrPhone, setScreenLinkOrPhone] = useState("");
  const [screenResumeUrl, setScreenResumeUrl] = useState<string | null>(null);
  const [screenQuestionsUrl, setScreenQuestionsUrl] = useState<string | null>(null);
  const [screenResponse, setScreenResponse] = useState<"None" | "Yes" | "No">("None");
  const [screenRejectionNote, setScreenRejectionNote] = useState<string>("");
  const [vendorJobDescUrl, setVendorJobDescUrl] = useState<string | null>(null);
  const [vendorUploading, setVendorUploading] = useState(false);
  const pendingScreenAfterVendorRef = useRef<any | null>(null);
  const pendingAssessmentAfterVendorRef = useRef<any | null>(null);

  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [assessmentSubmission, setAssessmentSubmission] = useState<any | null>(null);
  const [assessmentEndDate, setAssessmentEndDate] = useState("");
  const [assessmentLink, setAssessmentLink] = useState("");
  const [assessmentAttachmentUrl, setAssessmentAttachmentUrl] = useState<string | null>(null);
  const [assessmentFile, setAssessmentFile] = useState<File | null>(null);
  const [assessmentUploading, setAssessmentUploading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCandidateId, setNewCandidateId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newJobPortal, setNewJobPortal] = useState("");
  const [newJobLink, setNewJobLink] = useState("");
  const [page, setPage] = useState(1);
  const [candidateFilter, setCandidateFilter] = useState<string>("all");
  const [applicationsSheet, setApplicationsSheet] = useState<{ candidateId: string; candidateName: string } | null>(null);
  const [applicationsSheetPage, setApplicationsSheetPage] = useState(1);

  const isPaginatedRole = !isTeamLead;

  const summariesContext = useMemo((): ApplicationSummariesContext | null => {
    if (isCandidate) return null;
    if (isAgencyAdmin && profile?.agency_id) return { mode: "agency", agencyId: profile.agency_id };
    if (isRecruiter && user?.id) return { mode: "recruiter", recruiterId: user.id };
    if (isTeamLead && profile?.id) return { mode: "team_lead", teamLeadProfileId: profile.id };
    if (isAdmin || isManager) return { mode: "admin" };
    return null;
  }, [isCandidate, isAgencyAdmin, profile?.agency_id, profile?.id, isRecruiter, user?.id, isTeamLead, isAdmin, isManager]);

  const { data: applicationSummaries = [], isLoading: loadingSummaries } = useQuery({
    queryKey: ["application-summaries", summariesContext, search, statusFilter, sortBy, order, candidateFilter],
    queryFn: async () => {
      if (!summariesContext) return [];
      const candidateIdOpt = candidateFilter && candidateFilter !== "all" ? candidateFilter : undefined;
      return fetchCandidateApplicationSummaries(summariesContext, {
        search,
        status: statusFilter,
        sortBy,
        order,
        candidateId: candidateIdOpt,
      });
    },
    enabled: !!summariesContext && !!user,
  });

  const { data: submissionsResult, isLoading: loadingPaginated } = useQuery({
    queryKey: ["submissions", role, user?.id, profile?.linked_candidate_id, page, PAGE_SIZE, search, statusFilter, sortBy, order],
    queryFn: async () => {
      if (!profile?.linked_candidate_id) return { data: [], total: 0 };
      return fetchSubmissionsByCandidatePaginated(profile.linked_candidate_id, { page, pageSize: PAGE_SIZE, search, status: statusFilter, sortBy, order });
    },
    enabled: isPaginatedRole && !!user && isCandidate,
  });

  const { data: sheetSubmissions = [], isLoading: loadingSheetSubmissions } = useQuery({
    queryKey: ["candidate-submissions-sheet", applicationsSheet?.candidateId, statusFilter, search],
    queryFn: () =>
      fetchSubmissionsByCandidateWithDetails(applicationsSheet!.candidateId, {
        status: statusFilter,
        search,
      }),
    enabled: !!applicationsSheet?.candidateId,
  });

  const filteredSummaries = useMemo(() => {
    if (isCandidate) return [];
    let rows = applicationSummaries;
    if (isRecruiter && user?.id) {
      rows = rows.filter((r) => !r.recruiterId || r.recruiterId === user.id);
    }
    if (isAgencyAdmin && profile?.agency_id) {
      rows = rows.filter((r) => !r.agencyId || r.agencyId === profile.agency_id);
    }
    return rows;
  }, [applicationSummaries, isCandidate, isRecruiter, user?.id, isAgencyAdmin, profile?.agency_id]);

  const displaySubmissions = isCandidate ? (submissionsResult?.data ?? []) : [];
  const displayCandidates = !isCandidate
    ? filteredSummaries.slice((page - 1) * CANDIDATES_PAGE_SIZE, page * CANDIDATES_PAGE_SIZE)
    : [];
  const totalCount = isCandidate ? (submissionsResult?.total ?? 0) : filteredSummaries.length;
  const totalPages = isCandidate ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : Math.max(1, Math.ceil(totalCount / CANDIDATES_PAGE_SIZE));
  const isLoading = isCandidate ? loadingPaginated : loadingSummaries;
  useEffect(() => setPage(1), [search, statusFilter, sortBy, order, candidateFilter]);
  useEffect(() => {
    if (applicationsSheet?.candidateId) setApplicationsSheetPage(1);
  }, [applicationsSheet?.candidateId]);

  // fetch candidates for Add Application dropdown and for filter dropdown (admin: all, agency: agency, recruiter: assigned, team lead: under TL)
  const candidatesQueryFn = async () => {
    if (isAdmin || isManager) return fetchCandidates();
    if (isAgencyAdmin && profile?.agency_id) return fetchCandidatesBasic(profile.agency_id);
    if (isRecruiter && user?.id) return fetchCandidatesByRecruiter(user.id);
    if (isTeamLead && profile?.id) return fetchCandidatesByTeamLead(profile.id);
    return [];
  };

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["candidates-dropdown", role, user?.id, profile?.agency_id, profile?.id],
    queryFn: candidatesQueryFn,
    enabled: isAdmin || isManager || (isRecruiter && !!user?.id) || (isAgencyAdmin && !!profile?.agency_id) || (isTeamLead && !!profile?.id),
  });

  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies-submissions"],
    queryFn: fetchAgencies,
    enabled: !isCandidate,
  });
  const { data: recruiters = [] } = useQuery({
    queryKey: ["recruiters-submissions", isAgencyAdmin ? profile?.agency_id : "all"],
    queryFn: () => fetchProfilesByRole("recruiter", isAgencyAdmin ? profile?.agency_id ?? undefined : undefined),
    enabled: !isCandidate,
  });

  const getRecruiterName = (recruiterId: string | null) =>
    !recruiterId ? "—" : (recruiters as any[]).find((r: any) => r.user_id === recruiterId)?.full_name ?? "—";
  const getAgencyName = (agencyId: string | null) =>
    !agencyId ? "—" : (agencies as any[]).find((a: any) => a.id === agencyId)?.name ?? "—";

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await updateSubmissionStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["application-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-submissions-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-assessments"] });
      toast.success("Status updated");
    },
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

  const handleApplicationStatusChange = (s: any, v: string) => {
    if (v === "Vendor Responded") {
      if (submissionHasVendorDetails(s)) {
        updateStatus.mutate({ id: s.id, status: v });
        return;
      }
      setVendorSubmission(s);
      pendingScreenAfterVendorRef.current = null;
      pendingAssessmentAfterVendorRef.current = null;
      setVendorDialogOpen(true);
      return;
    }
    if (v === "Assessment") {
      if (submissionHasAssessmentDetails(s)) {
        updateStatus.mutate({ id: s.id, status: v });
        return;
      }
      if (s.status === "Applied") {
        if (submissionHasVendorDetails(s)) {
          setAssessmentSubmission(s);
          setAssessmentEndDate(s.assessment_end_date ? String(s.assessment_end_date).slice(0, 10) : "");
          setAssessmentLink(s.assessment_link || "");
          setAssessmentAttachmentUrl(s.assessment_attachment_url || null);
          setAssessmentFile(null);
          setAssessmentDialogOpen(true);
          return;
        }
        pendingAssessmentAfterVendorRef.current = s;
        pendingScreenAfterVendorRef.current = null;
        setVendorSubmission(s);
        setRate(s.rate != null ? Number(s.rate) : "");
        setRateType((s.rate_type as any) || "W2");
        setJobDescription(s.job_description || "");
        setJobType((s.job_type as "Remote" | "Hybrid" | "On-site") || "Remote");
        setCity(s.city || "");
        setStateValue(s.state || "");
        setVendorJobDescUrl(s.job_description_url || null);
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
      if (submissionHasScheduledScreen(s)) {
        updateStatus.mutate({ id: s.id, status: v });
        return;
      }
      if (submissionShouldPromptAssessmentBeforeScreen(s)) {
        setAssessmentSubmission(s);
        setAssessmentEndDate(s.assessment_end_date ? String(s.assessment_end_date).slice(0, 10) : "");
        setAssessmentLink(s.assessment_link || "");
        setAssessmentAttachmentUrl(s.assessment_attachment_url || null);
        setAssessmentFile(null);
        setAssessmentDialogOpen(true);
        return;
      }
      if (s.status === "Applied") {
        if (submissionHasVendorDetails(s)) {
          setScreenSubmission(s);
          resetScreenDialogFields();
          setScreenDialogOpen(true);
          return;
        }
        pendingScreenAfterVendorRef.current = s;
        pendingAssessmentAfterVendorRef.current = null;
        setVendorSubmission(s);
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
        if (submissionShouldPromptAssessmentBeforeScreen(s)) {
          toast.info("Complete the assessment (end date and link or file) before scheduling a screen call.");
          setAssessmentSubmission(s);
          setAssessmentEndDate(s.assessment_end_date ? String(s.assessment_end_date).slice(0, 10) : "");
          setAssessmentLink(s.assessment_link || "");
          setAssessmentAttachmentUrl(s.assessment_attachment_url || null);
          setAssessmentFile(null);
          setAssessmentDialogOpen(true);
          return;
        }
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
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-vendor-responded"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-screens"] });
      queryClient.invalidateQueries({ queryKey: ["submissions-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["application-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-submissions-sheet"] });
      toast.success("Submission updated");
      setVendorDialogOpen(false);
      setVendorSubmission(null);
      setRate("");
      setJobDescription("");
      setJobType("Remote");
      setCity("");
      setStateValue("");
      const newStatus = variables.payload?.status;
      if (newStatus) {
        queryClient.invalidateQueries({ queryKey: ["candidate-submissions-sheet"] });
      }
      const pendingScreen = pendingScreenAfterVendorRef.current;
      if (
        pendingScreen &&
        pendingScreen.id === variables.id &&
        variables.payload?.status === "Vendor Responded"
      ) {
        pendingScreenAfterVendorRef.current = null;
        const mergedScreen = { ...pendingScreen, ...variables.payload };
        if (submissionHasScheduledScreen(mergedScreen)) {
          updateStatus.mutate({ id: pendingScreen.id, status: "Screen Call" });
        } else if (submissionShouldPromptAssessmentBeforeScreen(mergedScreen)) {
          setAssessmentSubmission(pendingScreen);
          setAssessmentEndDate(
            pendingScreen.assessment_end_date ? String(pendingScreen.assessment_end_date).slice(0, 10) : ""
          );
          setAssessmentLink(pendingScreen.assessment_link || "");
          setAssessmentAttachmentUrl(pendingScreen.assessment_attachment_url || null);
          setAssessmentFile(null);
          setAssessmentDialogOpen(true);
        } else {
          setScreenSubmission(pendingScreen);
          resetScreenDialogFields();
          setScreenDialogOpen(true);
        }
      }
      const pendingAssessment = pendingAssessmentAfterVendorRef.current;
      if (
        pendingAssessment &&
        pendingAssessment.id === variables.id &&
        variables.payload?.status === "Vendor Responded"
      ) {
        pendingAssessmentAfterVendorRef.current = null;
        const mergedAssessment = { ...pendingAssessment, ...variables.payload };
        if (submissionHasAssessmentDetails(mergedAssessment)) {
          updateStatus.mutate({ id: pendingAssessment.id, status: "Assessment" });
        } else {
          setAssessmentSubmission(pendingAssessment);
          setAssessmentEndDate(
            pendingAssessment.assessment_end_date ? String(pendingAssessment.assessment_end_date).slice(0, 10) : ""
          );
          setAssessmentLink(pendingAssessment.assessment_link || "");
          setAssessmentAttachmentUrl(pendingAssessment.assessment_attachment_url || null);
          setAssessmentFile(null);
          setAssessmentDialogOpen(true);
        }
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

 

  const handleScreenFileUpload = async (submissionId: string, file: File, folder?: "resume" | "questions") => {
    try {
      const publicUrl = await uploadScreenCallFile(submissionId, file, folder);
      if (folder === "questions") setScreenQuestionsUrl(publicUrl);
      else setScreenResumeUrl(publicUrl);
      toast.success("Uploaded");
      // persist uploaded file URL immediately to the submission row
      try {
        const payload: any = {};
        if (folder === "questions") payload.screen_questions_url = publicUrl;
        else payload.screen_resume_url = publicUrl;
        await updateSubmissionMutation.mutateAsync({ id: submissionId, payload });
      } catch (err: any) {
        // show helpful error about RLS if it occurs
        if (err?.message && /row-level security/i.test(err.message)) {
          toast.error("Uploaded but saving URL to DB failed due to RLS. See project README for RLS setup.");
        } else {
          toast.error(err?.message || "Failed to save uploaded file URL");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
  };

  const handleVendorJobDescriptionUpload = async (submissionId: string, file: File) => {
    setVendorUploading(true);
    try {
      const publicUrl = await uploadVendorJobDescription(submissionId, file);
      setVendorJobDescUrl(publicUrl);
      toast.success("Job description uploaded");
      // persist URL immediately
      try {
        await updateSubmissionMutation.mutateAsync({ id: submissionId, payload: { job_description_url: publicUrl } });
      } catch (err: any) {
        toast.error("Uploaded but failed to save URL to DB");
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setVendorUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{isCandidate ? "My Applications" : "Applications"}</h1>
        <p className="text-sm text-muted-foreground">{isCandidate ? "Your job applications" : "Track all job applications"}</p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search applications..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {(isAdmin || isRecruiter || isAgencyAdmin) && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (candidatesLoading) {
                    toast.error("Loading candidates, please wait");
                    return;
                  }
                  if (isRecruiter && (!candidates || candidates.length === 0)) {
                    toast.error("No candidates assigned to you. Please create or assign a candidate first.");
                    return;
                  }
                  if (isAgencyAdmin && (!candidates || candidates.length === 0)) {
                    toast.error("No candidates assigned to your agency yet. Master admin must assign candidates to your agency first.");
                    return;
                  }
                  setAddDialogOpen(true);
                }}
                disabled={candidatesLoading || (isRecruiter && (!candidates || candidates.length === 0)) || (isAgencyAdmin && (!candidates || candidates.length === 0))}
              >
                Add Application
              </Button>
            </div>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {SUBMISSION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isCandidate && (
            <Select value={candidateFilter} onValueChange={setCandidateFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Candidate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All candidates</SelectItem>
                {(candidates || []).filter((c: any) => c && c.id).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name || ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

 

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isCandidate ? (
                    <>
                      <TableHead>
                        {isPaginatedRole ? (
                          <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => { setSortBy("client_name"); setOrder(sortBy === "client_name" ? (order === "asc" ? "desc" : "asc") : "asc"); }}>
                            Client {sortBy === "client_name" ? (order === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : null}
                          </button>
                        ) : "Client"}
                      </TableHead>
                      <TableHead>
                        {isPaginatedRole ? (
                          <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => { setSortBy("position"); setOrder(sortBy === "position" ? (order === "asc" ? "desc" : "asc") : "asc"); }}>
                            Position {sortBy === "position" ? (order === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : null}
                          </button>
                        ) : "Position"}
                      </TableHead>
                      <TableHead>Job Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        {isPaginatedRole ? (
                          <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => { setSortBy("created_at"); setOrder(sortBy === "created_at" ? (order === "asc" ? "desc" : "asc") : "desc"); }}>
                            Date {sortBy === "created_at" ? (order === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : null}
                          </button>
                        ) : "Date"}
                      </TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Application count</TableHead>
                      <TableHead>Agency</TableHead>
                      <TableHead className="w-10">Actions</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isCandidate ? (
                  displaySubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No applications found</TableCell>
                    </TableRow>
                  ) : (
                    displaySubmissions.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.client_name}</TableCell>
                        <TableCell>{s.position}</TableCell>
                        <TableCell className="text-muted-foreground">{s.job_type || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{s.city ? `${s.city}${s.state ? `, ${s.state}` : ""}` : "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={s.status}
                            onValueChange={(v) => handleApplicationStatusChange(s, v)}
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <Badge className={statusColors[s.status] || ""}>{s.status}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {SUBMISSION_STATUSES.map((st) => (
                                <SelectItem key={st} value={st}>{st}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )
                ) : displayCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No candidates with applications found</TableCell>
                  </TableRow>
                ) : (
                  displayCandidates.map((row) => (
                    <TableRow key={row.candidateId}>
                      <TableCell className="font-medium">{row.candidateName}</TableCell>
                      <TableCell className="text-muted-foreground">{getRecruiterName(row.recruiterId)}</TableCell>
                      <TableCell>{row.applicationCount}</TableCell>
                      <TableCell className="text-muted-foreground">{getAgencyName(row.agencyId)}</TableCell>
                      <TableCell className="w-10 p-1">
                        {row.applicationCount >= 1 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setApplicationsSheet({ candidateId: row.candidateId, candidateName: row.candidateName });
                              setApplicationsSheetPage(1);
                            }}
                            aria-label="View applications"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {!isLoading && totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {isCandidate
                ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount} applications`
                : `Showing ${(page - 1) * CANDIDATES_PAGE_SIZE + 1}–${Math.min(page * CANDIDATES_PAGE_SIZE, totalCount)} of ${totalCount} candidates`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Select value={String(page)} onValueChange={(v) => setPage(Number(v))}>
                <SelectTrigger className="w-[7rem] h-8">
                  <SelectValue>Page {page} of {totalPages}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <SelectItem key={p} value={String(p)}>Page {p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Left slider: candidate's applications (Client, Position, Status, Date) with pagination */}
      <Sheet open={!!applicationsSheet} onOpenChange={(open) => !open && setApplicationsSheet(null)}>
        <SheetContent side="left" className="w-[90vw] sm:w-1/2 sm:max-w-[50vw] overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle>Applications — {applicationsSheet?.candidateName ?? ""}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1 flex flex-col min-h-0">
            {loadingSheetSubmissions && sheetSubmissions.length === 0 ? (
              <div className="space-y-3 py-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sheetSubmissions.length > 0 ? (
              <>
                <div className="flex-1 overflow-auto">
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
                      {(() => {
                        const total = sheetSubmissions.length;
                        const sheetTotalPages = Math.max(1, Math.ceil(total / APPLICATIONS_SHEET_PAGE_SIZE));
                        const from = (applicationsSheetPage - 1) * APPLICATIONS_SHEET_PAGE_SIZE;
                        const to = Math.min(from + APPLICATIONS_SHEET_PAGE_SIZE, total);
                        const pageSubmissions = sheetSubmissions.slice(from, to);
                        return pageSubmissions.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.client_name}</TableCell>
                            <TableCell>{s.position}</TableCell>
                            <TableCell>
                              <Select
                                value={s.status}
                                onValueChange={(v) => handleApplicationStatusChange(s, v)}
                              >
                                <SelectTrigger className="h-8 w-[140px]">
                                  <Badge className={statusColors[s.status] || ""}>{s.status}</Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  {SUBMISSION_STATUSES.map((st) => (
                                    <SelectItem key={st} value={st}>{st}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/submissions/${s.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
                {(() => {
                  const total = sheetSubmissions.length;
                  const sheetTotalPages = Math.max(1, Math.ceil(total / APPLICATIONS_SHEET_PAGE_SIZE));
                  const from = (applicationsSheetPage - 1) * APPLICATIONS_SHEET_PAGE_SIZE;
                  const to = Math.min(from + APPLICATIONS_SHEET_PAGE_SIZE, total);
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 mt-3 shrink-0">
                      <p className="text-sm text-muted-foreground">
                        Showing {from + 1}–{to} of {total}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setApplicationsSheetPage((p) => Math.max(1, p - 1))} disabled={applicationsSheetPage <= 1}>
                          <ChevronLeft className="h-4 w-4" /> Previous
                        </Button>
                        <Select value={String(applicationsSheetPage)} onValueChange={(v) => setApplicationsSheetPage(Number(v))}>
                          <SelectTrigger className="w-[7rem] h-8">
                            <SelectValue>Page {applicationsSheetPage} of {sheetTotalPages}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: sheetTotalPages }, (_, i) => i + 1).map((p) => (
                              <SelectItem key={p} value={String(p)}>Page {p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => setApplicationsSheetPage((p) => Math.min(sheetTotalPages, p + 1))} disabled={applicationsSheetPage >= sheetTotalPages}>
                          Next <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : applicationsSheet ? (
              <p className="text-sm text-muted-foreground py-6">No applications match the current filters.</p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Application Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Application</DialogTitle></DialogHeader>
            <form onSubmit={async (e) => {
            e.preventDefault();
            // validations
            if (!newCandidateId) { toast.error("Please select a candidate"); return; }
            if (!newClientName || !newPosition) { toast.error("Client and Position are required"); return; }
            if (!newJobPortal || newJobPortal.trim() === "") { toast.error("Please select a Job Portal"); return; }
            if (!newJobLink || newJobLink.trim() === "") { toast.error("Please enter Job Link"); return; }
            try {
              // validate URL
              try {
                new URL(newJobLink);
              } catch {
                toast.error("Please enter a valid Job Link URL (include https://)");
                return;
              }

              await createSubmissionFn({
                candidate_id: newCandidateId,
                recruiter_id: user!.id,
                client_name: newClientName,
                position: newPosition,
                job_link: newJobLink,
                job_portal: newJobPortal,
                status: "Applied",
              });
              toast.success("Application added");
              queryClient.invalidateQueries({ queryKey: ["submissions"] });
              queryClient.invalidateQueries({ queryKey: ["application-summaries"] });
              setAddDialogOpen(false);
              // reset form
              setNewCandidateId(null);
              setNewClientName("");
              setNewPosition("");
              setNewJobPortal("");
              setNewJobLink("");
            } catch (err: any) {
              toast.error(err?.message || "Failed to add application");
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Candidate</Label>
              <Select value={newCandidateId ?? undefined} onValueChange={(v) => setNewCandidateId(v || null)}>
                <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                <SelectContent>
                  {(candidates || []).filter((c: any) => c && c.id).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name || ""} </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Position *</Label>
                <Input value={newPosition} onChange={(e) => setNewPosition(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Portal *</Label>
                <Select value={newJobPortal} onValueChange={setNewJobPortal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    <SelectItem value="Indeed">Indeed</SelectItem>
                    <SelectItem value="Monster">Monster</SelectItem>
                    <SelectItem value="ZipRecruiter">ZipRecruiter</SelectItem>
                    <SelectItem value="Company Website">Company Website</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Job Link *</Label>
                <Input value={newJobLink} onChange={(e) => setNewJobLink(e.target.value)} placeholder="https://example.com/job/123" required />
              </div>
            </div>
            <Button type="submit" className="w-full">Add Application</Button>
          </form>
        </DialogContent>
      </Dialog>
 
      {/* Vendor Responded Dialog */}
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
          <DialogHeader><DialogTitle>Vendor Responded Details</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!vendorSubmission) return;
            // Client-side validation: all fields required
            if (rate === "" || isNaN(Number(rate))) {
              toast.error("Please enter a valid Rate");
              return;
            }
            if (!rateType) {
              toast.error("Please select a Rate Type");
              return;
            }
            if ((!jobDescription || jobDescription.trim() === "") && !vendorJobDescUrl) {
              toast.error("Please enter the Job Description or upload a document");
              return;
            }
            if (!jobType) {
              toast.error("Please select the Job Type");
              return;
            }
            if (jobType !== "Remote" && (!city || city.trim() === "" || !stateValue)) {
              toast.error("Please provide City and State for non-Remote jobs");
              return;
            }
            const payload: any = {
              status: "Vendor Responded",
              rate: Number(rate),
              rate_type: rateType,
              job_description: jobDescription || null,
              job_description_url: vendorJobDescUrl ?? null,
              job_type: jobType,
              city: jobType !== "Remote" ? city : null,
              state: jobType !== "Remote" ? stateValue : null,
            };
            updateSubmissionMutation.mutate({ id: vendorSubmission.id, payload });
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rate (USD)</Label>
                <Input required value={rate} onChange={(e) => setRate(e.target.value === "" ? "" : Number(e.target.value))} type="number" />
              </div>
              <div className="space-y-2">
                <Label>Rate Type</Label>
                <Select value={rateType} onValueChange={(v) => setRateType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
                <div className="mt-2">
                  <Label>Or upload Job Description document</Label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (!f || !vendorSubmission) return;
                    handleVendorJobDescriptionUpload(vendorSubmission.id, f);
                  }} />
                  {vendorUploading && <div className="text-xs">Uploading...</div>}
                  {vendorJobDescUrl && <a href={vendorJobDescUrl} target="_blank" rel="noreferrer" className="text-xs text-info underline">View uploaded doc</a>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Type</Label>
                <Select value={jobType} onValueChange={(v) => setJobType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                    <Label>City</Label>
                    <Input required value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Select value={stateValue} onValueChange={(v) => setStateValue(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((st) => <SelectItem key={st.code} value={st.code}>{st.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={updateSubmissionMutation.isPending}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assessmentDialogOpen} onOpenChange={setAssessmentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assessment</DialogTitle></DialogHeader>
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
                onChange={(ev) => {
                  const f = ev.target.files?.[0] ?? null;
                  setAssessmentFile(f);
                }}
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

      {/* Screen Call Dialog */}
      <Dialog open={screenDialogOpen} onOpenChange={setScreenDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Screen Call</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!screenSubmission) return;
            // validation
            if (!screenDate || !screenTime) {
              toast.error("Please select date and time");
              return;
            }
            if (!screenMode) {
              toast.error("Please select mode");
              return;
            }
            // validate meeting link or phone format
            if (screenMode === "Virtual") {
              if (!screenLinkOrPhone || screenLinkOrPhone.trim() === "") {
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
              if (!screenLinkOrPhone || screenLinkOrPhone.trim() === "") {
                toast.error("Please provide phone number for Phone mode");
                return;
              }
              const phone = screenLinkOrPhone.trim();
              const phoneRe = /^\+?[0-9\-\s()]{7,}$/;
              if (!phoneRe.test(phone)) {
                toast.error("Please enter a valid phone number");
                return;
              }
            }

            // require uploaded documents
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
            setScreenDate("");
            setScreenTime("");
            setScreenLinkOrPhone("");
            setScreenResumeUrl(null);
            setScreenQuestionsUrl(null);
          }} className="space-y-4">
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <input type="file" accept=".pdf,.doc,.docx" onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (!f || !screenSubmission) return;
                  handleScreenFileUpload(screenSubmission.id, f, "resume");
                }} />
                {screenResumeUrl && <a href={screenResumeUrl} target="_blank" rel="noreferrer" className="text-xs text-info underline">View</a>}
              </div>
              <div className="space-y-2">
                <Label>Upload Interview Questions Doc</Label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (!f || !screenSubmission) return;
                  handleScreenFileUpload(screenSubmission.id, f, "questions");
                }} />
                {screenQuestionsUrl && <a href={screenQuestionsUrl} target="_blank" rel="noreferrer" className="text-xs text-info underline">View</a>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Screen Response</Label>
                <Select value={screenResponse} onValueChange={(v) => setScreenResponse(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rejection Note (if Rejected)</Label>
                <Input value={screenRejectionNote} onChange={(e) => setScreenRejectionNote(e.target.value)} placeholder="Rejection note" disabled={screenResponse !== "No"} />
              </div>
            </div>
            <Button type="submit" className="w-full">Save Screen Call</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
