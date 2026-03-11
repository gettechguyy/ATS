import { useState, useEffect } from "react";
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
import { fetchSubmissionsPaginated, fetchSubmissionsByRecruiterPaginated, fetchSubmissionsByCandidatePaginated, fetchSubmissionsByAgencyPaginated, fetchSubmissionsByTeamLead, updateSubmissionStatus, updateSubmission, createSubmission as createSubmissionFn } from "../../dbscripts/functions/submissions";
import { fetchCandidates, fetchCandidatesByRecruiter, fetchCandidatesBasic, fetchCandidatesByTeamLead } from "../../dbscripts/functions/candidates";
import { fetchAgencies } from "../../dbscripts/functions/agencies";
import { fetchProfilesByRole } from "../../dbscripts/functions/profiles";
import { uploadScreenCallFile, uploadVendorJobDescription } from "../../dbscripts/functions/storage";
import { US_STATES } from "@/lib/usStates";

const PAGE_SIZE = 10;
const CANDIDATES_PAGE_SIZE = 10; // candidates per page in main table (non-candidate view)
const SUBMISSIONS_FETCH_SIZE = 5000; // fetch this many submissions to group by candidate
const APPLICATIONS_SHEET_PAGE_SIZE = 10;
const SUBMISSION_STATUSES = ["Applied", "Vendor Responded", "Screen Call", "Interview", "Rejected", "Offered"] as const;

const statusColors: Record<string, string> = {
  Applied: "bg-secondary text-secondary-foreground",
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
  const [applicationsSheet, setApplicationsSheet] = useState<{ candidateName: string; submissions: any[] } | null>(null);
  const [applicationsSheetPage, setApplicationsSheetPage] = useState(1);

  const isPaginatedRole = !isTeamLead; // team lead uses fetchSubmissionsByTeamLead + client filter; others use paginated API
  const submissionsQueryFn = async () => {
    if (isTeamLead && profile?.id) return fetchSubmissionsByTeamLead(profile.id);
    return [];
  };
  const { data: submissionsTeamLead, isLoading: loadingTL } = useQuery({
    queryKey: ["submissions-tl", profile?.id],
    queryFn: submissionsQueryFn,
    enabled: isTeamLead && !!profile?.id,
  });
  const { data: submissionsResult, isLoading: loadingPaginated } = useQuery({
    queryKey: ["submissions", role, user?.id, profile?.linked_candidate_id, profile?.agency_id, isCandidate ? page : 1, isCandidate ? PAGE_SIZE : SUBMISSIONS_FETCH_SIZE, search, statusFilter, sortBy, order, candidateFilter],
    queryFn: async () => {
      if (isCandidate) {
        if (!profile?.linked_candidate_id) return { data: [], total: 0 };
        return fetchSubmissionsByCandidatePaginated(profile.linked_candidate_id, { page, pageSize: PAGE_SIZE, search, status: statusFilter, sortBy, order });
      }
      const candidateIdOpt = candidateFilter && candidateFilter !== "all" ? candidateFilter : undefined;
      if (isAgencyAdmin && profile?.agency_id) return fetchSubmissionsByAgencyPaginated(profile.agency_id, { page: 1, pageSize: SUBMISSIONS_FETCH_SIZE, search, status: statusFilter, sortBy, order, candidateId: candidateIdOpt });
      if (isRecruiter && user?.id) return fetchSubmissionsByRecruiterPaginated(user.id, { page: 1, pageSize: SUBMISSIONS_FETCH_SIZE, search, status: statusFilter, sortBy, order, candidateId: candidateIdOpt });
      return fetchSubmissionsPaginated({ page: 1, pageSize: SUBMISSIONS_FETCH_SIZE, search, status: statusFilter, sortBy, order, candidateId: candidateIdOpt });
    },
    enabled: isPaginatedRole && !!user,
  });
  const filteredTL = (submissionsTeamLead ?? []).filter((s: any) => {
    const candidateName = `${s.candidates?.first_name || ""} ${s.candidates?.last_name || ""}`.toLowerCase();
    const matchSearch = !search.trim() || s.client_name?.toLowerCase().includes(search.toLowerCase()) || s.position?.toLowerCase().includes(search.toLowerCase()) || candidateName.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchCandidate = candidateFilter === "all" || !candidateFilter || s.candidate_id === candidateFilter;
    return matchSearch && matchStatus && matchCandidate;
  });
  const allSubmissionsForGrouping = isTeamLead ? filteredTL : (submissionsResult?.data ?? []);
  const groupedByCandidateFull = !isCandidate && allSubmissionsForGrouping.length > 0
    ? (() => {
        const map = new Map<string, { candidateId: string; candidateName: string; recruiterId: string | null; agencyId: string | null; submissions: any[] }>();
        for (const s of allSubmissionsForGrouping as any[]) {
          const cid = s.candidate_id;
          const name = `${s.candidates?.first_name ?? ""} ${s.candidates?.last_name ?? ""}`.trim() || "—";
        const recId = s.candidates?.recruiter_id ?? null;
        const agId = s.candidates?.agency_id ?? null;

        // Hard guard: for recruiters, only show candidates where candidate.recruiter_id = current user.
        if (isRecruiter && user?.id && recId && recId !== user.id) continue;
        // Hard guard: for agency admins, only show candidates belonging to their agency.
        if (isAgencyAdmin && profile?.agency_id && agId && agId !== profile.agency_id) continue;

          if (!map.has(cid)) map.set(cid, { candidateId: cid, candidateName: name, recruiterId: recId, agencyId: agId, submissions: [] });
          map.get(cid)!.submissions.push(s);
        }
        return Array.from(map.values());
      })()
    : [];
  const displaySubmissions = isCandidate ? (submissionsResult?.data ?? []) : [];
  const displayCandidates = !isCandidate ? groupedByCandidateFull.slice((page - 1) * CANDIDATES_PAGE_SIZE, page * CANDIDATES_PAGE_SIZE) : [];
  const totalCount = isCandidate ? (submissionsResult?.total ?? 0) : groupedByCandidateFull.length;
  const totalPages = isCandidate ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : Math.max(1, Math.ceil(totalCount / CANDIDATES_PAGE_SIZE));
  const isLoading = isTeamLead ? loadingTL : loadingPaginated;
  useEffect(() => setPage(1), [search, statusFilter, sortBy, order, candidateFilter]);

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
      toast.success("Status updated");
    },
  });

  const updateSubmissionMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      await updateSubmission(id, payload);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
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
        setApplicationsSheet((prev) =>
          prev ? { ...prev, submissions: prev.submissions.map((sub) => (sub.id === variables.id ? { ...sub, status: newStatus } : sub)) } : null
        );
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
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Application count</TableHead>
                      <TableHead>Agency</TableHead>
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
                          <Badge className={statusColors[s.status] || ""}>{s.status}</Badge>
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
                      <TableCell className="w-10 p-1">
                        {row.submissions.length > 1 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => { setApplicationsSheet({ candidateName: row.candidateName, submissions: row.submissions }); setApplicationsSheetPage(1); }}
                            aria-label="Expand applications"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium">{row.candidateName}</TableCell>
                      <TableCell className="text-muted-foreground">{getRecruiterName(row.recruiterId)}</TableCell>
                      <TableCell>{row.submissions.length}</TableCell>
                      <TableCell className="text-muted-foreground">{getAgencyName(row.agencyId)}</TableCell>
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
            {applicationsSheet?.submissions && applicationsSheet.submissions.length > 0 ? (
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
                        const total = applicationsSheet.submissions.length;
                        const sheetTotalPages = Math.max(1, Math.ceil(total / APPLICATIONS_SHEET_PAGE_SIZE));
                        const from = (applicationsSheetPage - 1) * APPLICATIONS_SHEET_PAGE_SIZE;
                        const to = Math.min(from + APPLICATIONS_SHEET_PAGE_SIZE, total);
                        const pageSubmissions = applicationsSheet.submissions.slice(from, to);
                        return pageSubmissions.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.client_name}</TableCell>
                            <TableCell>{s.position}</TableCell>
                            <TableCell>
                              <Select
                                value={s.status}
                                onValueChange={(v) => {
                                  if (v === "Vendor Responded") {
                                    setVendorSubmission(s);
                                    setVendorDialogOpen(true);
                                  } else if (v === "Screen Call") {
                                    setScreenSubmission(s);
                                    setScreenDialogOpen(true);
                                  } else {
                                    updateStatus.mutate(
                                      { id: s.id, status: v },
                                      {
                                        onSuccess: () => {
                                          setApplicationsSheet((prev) =>
                                            prev ? { ...prev, submissions: prev.submissions.map((sub) => (sub.id === s.id ? { ...sub, status: v } : sub)) } : null
                                          );
                                        },
                                      }
                                    );
                                  }
                                }}
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
                  const total = applicationsSheet.submissions.length;
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
      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
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
