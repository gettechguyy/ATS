import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { ArrowLeft, Plus, FileText, Calendar, ChevronDown, Download, Eye, EyeOff, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import ResumeUpload from "@/components/ResumeUpload";
import CoverLetterUpload from "@/components/CoverLetterUpload";
import DocumentUpload from "@/components/DocumentUpload";
import { US_STATES } from "@/lib/usStates";
import { fetchCandidateById, updateCandidateStatus, updateCandidate as updateCandidateFn } from "../../dbscripts/functions/candidates";
import { fetchEducationsByCandidate, createEducation, deleteEducation } from "../../dbscripts/functions/educations";
import { fetchExperiencesByCandidate, createExperience, deleteExperience } from "../../dbscripts/functions/experiences";
import { fetchSubmissionsByCandidatePaginated, createSubmission as createSubmissionFn } from "../../dbscripts/functions/submissions";
import { fetchProfileName, fetchProfilesBySelect, fetchProfilesByRole } from "../../dbscripts/functions/profiles";
import { fetchAllUserRoles } from "../../dbscripts/functions/userRoles";
import { fetchAgencies } from "../../dbscripts/functions/agencies";

const CANDIDATE_STATUSES = ["New", "Ready For Assign", "Ready For Marketing", "In Marketing", "Placed", "Backout", "On Bench", "In Training"] as const;
const APPLICATIONS_PAGE_SIZE = 10;
const VISA_STATUSES = ["CPT", "OPT", "STEM OPT", "H1-B", "H4-EAD", "GC-EAD", "Green Card", "US Citizen", "Other"] as const;
const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say", "Other"] as const;

const MASK = "*******";

/** Compact profile grids: 1 → 2 → 3 → 4 columns by breakpoint */
const pfGrid =
  "grid max-w-full gap-3 pb-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-min";
const pfField = "space-y-1.5 w-full min-w-0";
/** Full row on sm and lg; half row on xl so pairs sit side by side in the 4-col layout */
const pfPair = "space-y-1.5 w-full min-w-0 sm:col-span-2 lg:col-span-3 xl:col-span-2";
/** Full row at each breakpoint */
const pfFullRow = "space-y-1.5 w-full min-w-0 sm:col-span-2 lg:col-span-3 xl:col-span-4";
const pfInput = "h-9 px-2.5 py-1.5 w-full min-w-0";

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isAdmin, isRecruiter, isCandidate, isManager, isAgencyAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVisa, setEditVisa] = useState("Other");
  const [editVisaCopyUploaded, setEditVisaCopyUploaded] = useState(false);
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
  const [editGender, setEditGender] = useState("");
  // Education / professional / marketing local state
  const [degree, setDegree] = useState("");
  const [institution, setInstitution] = useState("");
  const [graduationYear, setGraduationYear] = useState<string | null>(null);

  const [technology, setTechnology] = useState("");
  const [experienceYears, setExperienceYears] = useState<number | "">("");
  const [primarySkills, setPrimarySkills] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [expectedSalaryLocal, setExpectedSalaryLocal] = useState<string>("");
  const [interviewAvailability, setInterviewAvailability] = useState("");
  const [openToRelocateLocal, setOpenToRelocateLocal] = useState(false);
  const [client1, setClient1] = useState("");
  const [client2, setClient2] = useState("");
  const [reference1, setReference1] = useState("");
  const [reference2, setReference2] = useState("");
  // coverLetter is handled by CoverLetterUpload component; no local URL input needed.

  const [marketingGmail, setMarketingGmail] = useState("");
  const [marketingGmailPass, setMarketingGmailPass] = useState("");
  const [marketingLinkedIn, setMarketingLinkedIn] = useState("");
  const [marketingLinkedInPass, setMarketingLinkedInPass] = useState("");
  const [marketingGoVoice, setMarketingGoVoice] = useState("");
  const [marketingGoVoicePass, setMarketingGoVoicePass] = useState("");
  const [marketingOther, setMarketingOther] = useState("");
  const [marketingSubmittedLocal, setMarketingSubmittedLocal] = useState(false);
  const [marketingSubmitting, setMarketingSubmitting] = useState(false);
  const [showGmailPass, setShowGmailPass] = useState(false);
  const [showLinkedInPass, setShowLinkedInPass] = useState(false);
  const [showGoVoicePass, setShowGoVoicePass] = useState(false);
  const [appsOpen, setAppsOpen] = useState(true);
  const [eduOpen, setEduOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [applicationsPage, setApplicationsPage] = useState(1);

  const isOwnProfile = isCandidate && profile?.linked_candidate_id === id;

  const { data: candidate, isLoading, isError, error: candidateError, refetch: refetchCandidate } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => fetchCandidateById(id!),
    enabled: !!id,
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: fetchAgencies,
    enabled: !isAgencyAdmin,
  });

  useEffect(() => {
    if (candidate) setEditVisa(candidate.visa_status || "Other");
    if (candidate) {
      setEditFirstName(candidate.first_name || "");
      setEditLastName(candidate.last_name || "");
      setEditEmail(candidate.email || "");
      setEditPhone(candidate.phone || "");
      setEditCity((candidate as any).city || "");
      setEditState((candidate as any).state || "");
      setEditZip((candidate as any).zip || "");
      setEditGender((candidate as any).gender || "");
    }
    if (candidate) {
      setDegree((candidate as any).degree || "");
      setInstitution((candidate as any).institution || "");
      setGraduationYear((candidate as any).graduation_year || null);

      setTechnology((candidate as any).technology || "");
      setExperienceYears((candidate as any).experience_years ?? "");
      setPrimarySkills((candidate as any).primary_skills || "");
      setTargetRole((candidate as any).target_role || "");
      setExpectedSalaryLocal((candidate as any).expected_salary ? String((candidate as any).expected_salary) : "");
      setInterviewAvailability((candidate as any).interview_availability || "");
      setOpenToRelocateLocal(Boolean((candidate as any).open_to_relocate));
      setClient1((candidate as any).client1 || "");
      setClient2((candidate as any).client2 || "");
      setReference1((candidate as any).reference1 || "");
      setReference2((candidate as any).reference2 || "");
      // cover letter URL is displayed/managed via the upload component above
      // (candidate as any).cover_letter_url is available via `candidate` when needed

      setMarketingGmail((candidate as any).marketing_gmail || "");
      setMarketingGmailPass((candidate as any).marketing_gmail_pass || "");
      setMarketingLinkedIn((candidate as any).marketing_linkedin || "");
      setMarketingLinkedInPass((candidate as any).marketing_linkedin_pass || "");
      setMarketingGoVoice((candidate as any).marketing_govoice || "");
      setMarketingGoVoicePass((candidate as any).marketing_govoice_pass || "");
      setMarketingOther((candidate as any).marketing_other || "");
      setMarketingSubmittedLocal(Boolean((candidate as any).marketing_submitted));
    }
  }, [candidate?.id]);

  const { data: submissionsResult } = useQuery({
    queryKey: ["candidate-submissions", id, applicationsPage, APPLICATIONS_PAGE_SIZE],
    queryFn: () => fetchSubmissionsByCandidatePaginated(id!, { page: applicationsPage, pageSize: APPLICATIONS_PAGE_SIZE }),
    enabled: !!id,
  });
  const submissions = submissionsResult?.data ?? [];
  const submissionsTotal = submissionsResult?.total ?? 0;
  const applicationsTotalPages = Math.max(1, Math.ceil(submissionsTotal / APPLICATIONS_PAGE_SIZE));
  useEffect(() => setApplicationsPage(1), [id]);
  const { data: educations } = useQuery({
    queryKey: ["candidate-educations", id],
    queryFn: () => fetchEducationsByCandidate(id!),
    enabled: !!id,
  });
  const { data: experiences } = useQuery({
    queryKey: ["candidate-experiences", id],
    queryFn: () => fetchExperiencesByCandidate(id!),
    enabled: !!id,
  });

  const { data: recruiterProfile } = useQuery({
    queryKey: ["recruiter-profile", candidate?.recruiter_id],
    queryFn: () => fetchProfileName(candidate!.recruiter_id!),
    enabled: !!candidate?.recruiter_id,
  });

  const { data: recruiters } = useQuery({
    queryKey: ["recruiters", isAgencyAdmin ? profile?.agency_id : "master"],
    queryFn: () => fetchProfilesByRole("recruiter", isAgencyAdmin ? profile?.agency_id ?? undefined : undefined),
    enabled: (isAdmin || isAgencyAdmin) && !!candidate,
  });
  const canAssignRecruiter = isAdmin || (isAgencyAdmin && candidate?.agency_id === profile?.agency_id);

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

  const createEducationMutation = useMutation({
    mutationFn: async (payload: any) => {
      await createEducation({ candidate_id: id!, ...payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-educations", id] });
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Education added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteEducationMutation = useMutation({
    mutationFn: async (eid: string) => {
      await deleteEducation(eid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-educations", id] });
      toast.success("Education removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createExperienceMutation = useMutation({
    mutationFn: async (payload: any) => {
      await createExperience({ candidate_id: id!, ...payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-experiences", id] });
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
      toast.success("Experience added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteExperienceMutation = useMutation({
    mutationFn: async (eid: string) => {
      await deleteExperience(eid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-experiences", id] });
      toast.success("Experience removed");
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
        job_link: (fd.get("job_link") as string) || null,
        job_portal: (fd.get("job_portal") as string) || null,
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

  const isBasicDetailsComplete = Boolean(
    candidate?.first_name?.trim() && candidate?.last_name?.trim() && candidate?.visa_status && (candidate?.email?.trim() || candidate?.phone?.trim())
  );
  const isProfessionalDetailsComplete = Boolean(
    (candidate as any)?.technology?.trim() &&
    ((candidate as any)?.experience_years != null && (candidate as any)?.experience_years !== "") &&
    (candidate as any)?.primary_skills?.trim() &&
    (candidate as any)?.target_role?.trim() &&
    (candidate as any)?.expected_salary != null &&
    (candidate as any)?.interview_availability?.trim()
  );
  const canAddMarketingDetails = isBasicDetailsComplete && isProfessionalDetailsComplete && (educations?.length ?? 0) >= 1 && (experiences?.length ?? 0) >= 1;

  const safeStatus = (candidate?.status && (CANDIDATE_STATUSES as readonly string[]).includes(candidate.status)) ? candidate.status : "New";

  const hasSetReadyForAssignRef = useRef(false);
  useEffect(() => {
    if (!id || !candidate || candidate.status !== "New" || !canAddMarketingDetails || hasSetReadyForAssignRef.current) return;
    hasSetReadyForAssignRef.current = true;
    updateCandidateStatus(id, "Ready For Assign").then(() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })).catch(() => {});
  }, [id, candidate?.id, candidate?.status, canAddMarketingDetails]);

  if (isCandidate && !isOwnProfile) return <Navigate to="/" replace />;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-lg border bg-card p-8">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Loading candidate...</p>
        <div className="flex flex-col gap-2 w-full max-w-md">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !candidate) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-lg border bg-card p-8">
        <p className="text-center text-muted-foreground">
          {isError ? (candidateError?.message || "Failed to load candidate") : "Candidate not found"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/candidates">Back to Candidates</Link>
          </Button>
          {isError && (
            <Button variant="default" onClick={() => refetchCandidate()}>
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isAgencyAdmin && candidate.agency_id !== profile?.agency_id) {
    return <Navigate to="/candidates" replace />;
  }

  // Only master admin (not agency admin) and the candidate themselves can see personal contact details.
  const canSeePersonalDetails = (isAdmin && !isAgencyAdmin) || isOwnProfile;
  const displayEmail = canSeePersonalDetails ? (candidate.email || "—") : "—";
  const displayPhone = canSeePersonalDetails ? (candidate.phone || "—") : "—";
  const showVisaStatus = isAdmin || isRecruiter || isOwnProfile;
  // Main company sees "Name (Agency Name)" for agency-assigned candidates; agency viewer sees name only.
  const displayCandidateTitle = () => {
    const name = `${candidate.first_name || ""} ${(candidate.last_name || "").trim()}`.trim() || "—";
    if (isAgencyAdmin || !candidate.agency_id || !agencies?.length) return name;
    const agency = (agencies as any[]).find((a: any) => a.id === candidate.agency_id);
    return agency ? `${name} (${agency.name})` : name;
  };
  // Main company sees "Recruiter Name (Agency Name)" for agency recruiters; agency viewer sees name only (same as User Management).
  const displayRecruiterName = (recruiterId: string | null) => {
    if (!recruiterId) return "—";
    const r = recruiters?.find((x: any) => x.user_id === recruiterId);
    const name = r?.full_name ?? recruiterProfile?.full_name ?? "—";
    if (isAgencyAdmin || !r?.agency_id || !agencies?.length) return name;
    const agency = (agencies as any[]).find((a: any) => a.id === r.agency_id);
    return agency ? `${name} (${agency.name})` : name;
  };

  const canEditBasicIdentity = isOwnProfile || (isAdmin && !isAgencyAdmin);
  const canSaveProfile = isOwnProfile || isAdmin;

  try {
    return (
      <div className="min-w-0 max-w-full">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to={isCandidate ? "/" : "/candidates"}><ArrowLeft className="mr-2 h-4 w-4" />{isCandidate ? "Back to Dashboard" : "Back to Candidates"}</Link>
      </Button>

      <div className="flex min-w-0 max-w-full flex-col gap-6">
        {/* Candidate profile: grouped into collapsible sections */}
        <Card className="min-w-0 overflow-visible">
          <CardHeader>
            <CardTitle className="text-lg">{displayCandidateTitle()}</CardTitle>
            {canSaveProfile && (
              <p className="text-sm text-muted-foreground mt-1">Open a section to edit. <strong>Save</strong> at the bottom updates everything together.</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <Accordion type="multiple" defaultValue={["personal"]} className="w-full space-y-2 [&_input]:h-9 [&_input]:px-2.5 [&_input]:py-1.5">
              <AccordionItem value="personal" className="rounded-lg border border-border/70 bg-muted/20 px-4 border-b-0">
                <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:pb-2">
                  Personal &amp; contact
                </AccordionTrigger>
                <AccordionContent>
                  <div className={pfGrid}>
                    {canEditBasicIdentity ? (
                      <>
                        <div className={pfField}>
                          <Label className="text-xs font-medium text-muted-foreground">First name *</Label>
                          <Input className={pfInput} value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                        </div>
                        <div className={pfField}>
                          <Label className="text-xs font-medium text-muted-foreground">Last name</Label>
                          <Input className={pfInput} value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                        </div>
                      </>
                    ) : (
                      <div className={`space-y-1 ${pfFullRow}`}>
                        <p className="text-xs font-medium text-muted-foreground">Name</p>
                        <p className="font-medium">{`${candidate.first_name || ""} ${(candidate.last_name || "").trim()}`.trim() || "—"}</p>
                      </div>
                    )}
                    {canSeePersonalDetails && (
                      <>
                        {canEditBasicIdentity ? (
                          <>
                            <div className={pfField}>
                              <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                              <Input className={pfInput} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                            </div>
                            <div className={pfField}>
                              <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                              <Input className={pfInput} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                            </div>
                          </>
                        ) : (
                          <>
                            {Boolean(candidate.email) && (
                              <div className={`space-y-1 ${pfField}`}>
                                <p className="text-xs font-medium text-muted-foreground">Email</p>
                                <div>{displayEmail}</div>
                              </div>
                            )}
                            {Boolean(candidate.phone) && (
                              <div className={`space-y-1 ${pfField}`}>
                                <p className="text-xs font-medium text-muted-foreground">Phone</p>
                                <div>{displayPhone}</div>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {showVisaStatus && (
                      <div className={pfField}>
                        <Label className="text-xs font-medium text-muted-foreground">Gender</Label>
                        <div className="flex items-center gap-2">
                          {canEditBasicIdentity ? (
                            <Select value={editGender || "none"} onValueChange={(v) => setEditGender(v === "none" ? "" : v)}>
                              <SelectTrigger className="h-9 w-full min-w-0 px-2.5"><SelectValue placeholder="Select gender" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {GENDER_OPTIONS.map((g) => (
                                  <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{(candidate as any).gender || "—"}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {canEditBasicIdentity ? (
                      <>
                        <div className={pfField}>
                          <Label className="text-xs font-medium text-muted-foreground">City</Label>
                          <Input className={pfInput} value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                        </div>
                        <div className={pfField}>
                          <Label className="text-xs font-medium text-muted-foreground">State</Label>
                          <Select value={editState} onValueChange={(v) => setEditState(v)}>
                            <SelectTrigger className="h-9 w-full min-w-0 px-2.5"><SelectValue placeholder="State" /></SelectTrigger>
                            <SelectContent>
                              {US_STATES.map((st) => <SelectItem key={st.code} value={st.code}>{st.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className={pfField}>
                          <Label className="text-xs font-medium text-muted-foreground">Zip</Label>
                          <Input className={pfInput} value={editZip} onChange={(e) => setEditZip(e.target.value)} />
                        </div>
                      </>
                    ) : (
                      <div className={`space-y-1 ${pfFullRow}`}>
                        <p className="text-xs font-medium text-muted-foreground">Current Location</p>
                        <p>{[editCity, editState, editZip].filter(Boolean).join(", ") || "—"}</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="professional" className="rounded-lg border border-border/70 bg-muted/20 px-4 border-b-0">
                <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:pb-2">
                  Professional profile &amp; documents
                </AccordionTrigger>
                <AccordionContent>
                  <div className={pfGrid}>
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Technology</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={technology} onChange={(e) => setTechnology(e.target.value)} /> : <div className="text-sm">{technology || "—"}</div>}
                    </div>
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Experience (years)</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} type="number" value={experienceYears as any} onChange={(e) => setExperienceYears(e.target.value === "" ? "" : Number(e.target.value))} /> : <div className="text-sm">{experienceYears !== "" && experienceYears != null ? `${experienceYears} years` : "—"}</div>}
                    </div>
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Expected Salary</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} type="number" value={expectedSalaryLocal} onChange={(e) => setExpectedSalaryLocal(e.target.value)} /> : <div className="text-sm">{expectedSalaryLocal ? `$${Number(expectedSalaryLocal).toLocaleString()}` : "—"}</div>}
                    </div>
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Open to Relocate</Label>
                      {(isOwnProfile || isAdmin) ? (
                        <Select value={openToRelocateLocal ? "yes" : "no"} onValueChange={(v) => setOpenToRelocateLocal(v === "yes")}>
                          <SelectTrigger className="h-9 w-full min-w-0 px-2.5"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                        </Select>
                      ) : <div className="text-sm">{openToRelocateLocal ? "Yes" : "No"}</div>}
                    </div>
                    <div className={pfPair}>
                      <Label className="text-xs font-medium text-muted-foreground">Primary Skills</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={primarySkills} onChange={(e) => setPrimarySkills(e.target.value)} /> : <div className="text-sm">{primarySkills || "—"}</div>}
                    </div>
                    <div className={pfPair}>
                      <Label className="text-xs font-medium text-muted-foreground">Target Role</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={targetRole} onChange={(e) => setTargetRole(e.target.value)} /> : <div className="text-sm">{targetRole || "—"}</div>}
                    </div>
                    <div className={pfFullRow}>
                      <Label className="text-xs font-medium text-muted-foreground">Interview Availability</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={interviewAvailability} onChange={(e) => setInterviewAvailability(e.target.value)} /> : <div className="text-sm">{interviewAvailability || "—"}</div>}
                    </div>
                    <div className={pfPair}>
                      <Label className="text-xs font-medium text-muted-foreground">Resume</Label>
                      <div>
                        {(isOwnProfile || isAdmin) ? (
                          <ResumeUpload
                            candidateId={candidate.id}
                            currentUrl={candidate.resume_url}
                            onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                          />
                        ) : (isAdmin || isManager || isRecruiter || isAgencyAdmin || isOwnProfile) ? (
                          candidate.resume_url ? (
                            <span className="inline-flex items-center gap-2">
                              <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="text-xs text-info underline">View Resume</a>
                              <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" download className="text-muted-foreground hover:text-foreground" title="Download resume" aria-label="Download resume"><Download className="h-4 w-4" /></a>
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>
                    <div className={pfPair}>
                      <Label className="text-xs font-medium text-muted-foreground">Cover Letter</Label>
                      <div>
                        {(isOwnProfile || isAdmin) ? (
                          <CoverLetterUpload
                            candidateId={candidate.id}
                            currentUrl={(candidate as any).cover_letter_url || null}
                            onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                          />
                        ) : (isAdmin || isManager || isRecruiter || isAgencyAdmin || isOwnProfile) ? (
                          (candidate as any).cover_letter_url ? (
                            <span className="inline-flex items-center gap-2">
                              <a href={(candidate as any).cover_letter_url} target="_blank" rel="noopener noreferrer" className="text-xs text-info underline">View Cover Letter</a>
                              <a href={(candidate as any).cover_letter_url} target="_blank" rel="noopener noreferrer" download className="text-muted-foreground hover:text-foreground" title="Download cover letter" aria-label="Download cover letter"><Download className="h-4 w-4" /></a>
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="education-visa" className="rounded-lg border border-border/70 bg-muted/20 px-4 border-b-0">
                <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:pb-2">
                  Education summary, visa &amp; ID
                </AccordionTrigger>
                <AccordionContent>
                  <div className={pfGrid}>
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Education Level (Degree)</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. Bachelors" /> : <div className="text-sm">{degree || "—"}</div>}
                    </div>
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Institution</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={institution} onChange={(e) => setInstitution(e.target.value)} /> : <div className="text-sm">{institution || "—"}</div>}
                    </div>
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Passing / Graduation Year</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={graduationYear ?? ""} onChange={(e) => setGraduationYear(e.target.value || null)} placeholder="Year" /> : <div className="text-sm">{graduationYear || "—"}</div>}
                    </div>
                    {showVisaStatus && (
                      <div className={`space-y-1.5 ${pfFullRow}`}>
                        <Label className="text-xs font-medium text-muted-foreground">Visa Status</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          {canEditBasicIdentity ? (
                            <Select value={editVisa} onValueChange={(v) => setEditVisa(v)}>
                              <SelectTrigger className="h-9 w-full min-w-0 max-w-md px-2.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {VISA_STATUSES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{candidate.visa_status || "—"}</span>
                          )}
                          {((candidate as any).visa_copy_url && (candidate.visa_status !== "US Citizen" && candidate.visa_status !== "Green Card")) ? (
                            <a href={(candidate as any).visa_copy_url} target="_blank" rel="noopener noreferrer" className="text-info" title="Download visa copy">
                              <Download className="h-4 w-4" />
                            </a>
                          ) : null}
                          {canEditBasicIdentity && editVisa !== "US Citizen" && editVisa !== "Green Card" && (
                            <DocumentUpload
                              candidateId={candidate.id}
                              currentUrl={(candidate as any).visa_copy_url || null}
                              folder="visa"
                              onUploaded={() => {
                                setEditVisaCopyUploaded(true);
                                queryClient.invalidateQueries({ queryKey: ["candidate", id] });
                              }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    <div className={pfFullRow}>
                      <Label className="text-xs font-medium text-muted-foreground">ID Proof</Label>
                      {((candidate as any).id_copy_url) ? (
                        <a href={(candidate as any).id_copy_url} target="_blank" rel="noopener noreferrer" className="text-xs text-info underline">View</a>
                      ) : ((isAdmin || isOwnProfile) ? (
                        <DocumentUpload
                          candidateId={candidate.id}
                          currentUrl={null}
                          folder="id"
                          onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="workflow" className="rounded-lg border border-border/70 bg-muted/20 px-4 border-b-0">
                <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:pb-2">
                  Recruiter, status &amp; references
                </AccordionTrigger>
                <AccordionContent>
                  <div className={pfGrid}>
                    {canAssignRecruiter && recruiters && (
                      <div className={pfFullRow}>
                        <Label className="text-xs font-medium text-muted-foreground">Assign Recruiter</Label>
                        <Select
                          value={candidate.recruiter_id || "unassigned"}
                          onValueChange={(v) => {
                            const updates: Record<string, any> = { recruiter_id: v === "unassigned" ? null : v };
                            if (v !== "unassigned") updates.status = "Ready For Marketing";
                            updateCandidate.mutate(updates, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidate", id] }) });
                          }}
                        >
                          <SelectTrigger className="h-9 w-full min-w-0 max-w-xl px-2.5"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {recruiters.map((r: any) => (
                              <SelectItem key={r.user_id} value={r.user_id}>{displayRecruiterName(r.user_id)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!canAssignRecruiter && (
                      <div className={`space-y-1 ${pfFullRow}`}>
                        <p className="text-xs font-medium text-muted-foreground">Recruiter Assigned</p>
                        <div>{displayRecruiterName(candidate.recruiter_id ?? null)}</div>
                      </div>
                    )}
                    {isAdmin && (
                      <div className={pfField}>
                        <Label className="text-xs font-medium text-muted-foreground">Status (Admin only)</Label>
                        <Select value={safeStatus} onValueChange={(v) => updateStatus.mutate(v)}>
                          <SelectTrigger className="h-9 w-full min-w-0 px-2.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CANDIDATE_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!isAdmin && (
                      <div className={`space-y-1 ${pfField}`}>
                        <p className="text-xs font-medium text-muted-foreground">Status</p>
                        <Badge variant="outline">{safeStatus}</Badge>
                      </div>
                    )}
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Client 1 (Recent)</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={client1} onChange={(e) => setClient1(e.target.value)} /> : <div className="text-sm">{client1 || "—"}</div>}
                    </div>
                    <div className={pfField}>
                      <Label className="text-xs font-medium text-muted-foreground">Client 2 (Past)</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={client2} onChange={(e) => setClient2(e.target.value)} /> : <div className="text-sm">{client2 || "—"}</div>}
                    </div>
                    <div className={pfPair}>
                      <Label className="text-xs font-medium text-muted-foreground">Reference 1</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={reference1} onChange={(e) => setReference1(e.target.value)} /> : <div className="text-sm">{reference1 || "—"}</div>}
                    </div>
                    <div className={pfPair}>
                      <Label className="text-xs font-medium text-muted-foreground">Reference 2</Label>
                      {(isOwnProfile || isAdmin) ? <Input className={pfInput} value={reference2} onChange={(e) => setReference2(e.target.value)} /> : <div className="text-sm">{reference2 || "—"}</div>}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {canSaveProfile && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  onClick={async () => {
                    if (canEditBasicIdentity) {
                      if (!editFirstName?.trim()) {
                        toast.error("First name is required");
                        return;
                      }
                      if (editVisa !== "Green Card" && editVisa !== "US Citizen") {
                        const hasExisting = Boolean((candidate as any).visa_copy_url);
                        if (!hasExisting && !editVisaCopyUploaded) {
                          toast.error("Visa copy is required for the selected visa status");
                          return;
                        }
                      }
                    }
                    if (!technology || technology.trim() === "") { toast.error("Technology is required"); return; }
                    if (experienceYears === "" || experienceYears === null) { toast.error("Experience (years) is required"); return; }
                    if (!primarySkills || primarySkills.trim() === "") { toast.error("Primary skills are required"); return; }
                    if (!targetRole || targetRole.trim() === "") { toast.error("Target role is required"); return; }
                    if (!expectedSalaryLocal || expectedSalaryLocal.trim() === "") { toast.error("Expected salary is required"); return; }
                    if (!interviewAvailability || interviewAvailability.trim() === "") { toast.error("Interview availability is required"); return; }
                    const payload: Record<string, any> = {
                      degree,
                      institution,
                      graduation_year: graduationYear,
                      technology,
                      experience_years: typeof experienceYears === "string" ? null : experienceYears,
                      primary_skills: primarySkills,
                      target_role: targetRole,
                      expected_salary: expectedSalaryLocal ? Number(expectedSalaryLocal) : null,
                      interview_availability: interviewAvailability,
                      open_to_relocate: openToRelocateLocal,
                      client1,
                      client2,
                      reference1,
                      reference2,
                    };
                    if (canEditBasicIdentity) {
                      payload.first_name = editFirstName.trim();
                      payload.last_name = editLastName.trim() || null;
                      payload.email = editEmail.trim() || null;
                      payload.phone = editPhone.trim() || null;
                      payload.gender = editGender || null;
                      payload.city = editCity || null;
                      payload.state = editState || null;
                      payload.zip = editZip || null;
                      payload.visa_status = editVisa;
                    }
                    try {
                      await updateCandidate.mutateAsync(payload);
                      setEditVisaCopyUploaded(false);
                    } catch {
                      /* handled by mutation */
                    }
                  }}
                  disabled={updateCandidate.isPending}
                >
                  {updateCandidate.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Applications — below profile, collapsible */}
        <Card>
          <CardHeader className="relative flex flex-row flex-wrap items-center justify-between gap-2 pr-10">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Applications ({submissionsTotal})
            </CardTitle>
            <div className="flex items-center gap-2">
            {(isAdmin || isRecruiter) && (
            <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3 w-3" />Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Submission</DialogTitle></DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const jobLink = ((fd.get("job_link") as string) || "").trim();
                    const jobPortal = ((fd.get("job_portal") as string) || "").trim();
                    if (!jobPortal) {
                      toast.error("Please select a job portal");
                      return;
                    }
                    if (!jobLink) {
                      toast.error("Job Link is required");
                      return;
                    }
                    try {
                      new URL(jobLink);
                    } catch {
                      toast.error("Please enter a valid Job Link URL (include https://)");
                      return;
                    }
                    createSubmission.mutate(new FormData(e.currentTarget));
                  }}
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
                  <div className="space-y-2">
                    <Label>Job Portal *</Label>
                    <Select name="job_portal" defaultValue="">
                      <SelectTrigger><SelectValue placeholder="Select portal" /></SelectTrigger>
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
                    <Input name="job_link" type="url" placeholder="https://example.com/job/123" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={createSubmission.isPending}>
                    Add Submission
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            )}
            </div>
            <button type="button" className="absolute right-3 top-3 p-1 rounded-md hover:bg-muted" onClick={() => setAppsOpen((v) => !v)} aria-label="Toggle applications list">
              <ChevronDown className={`h-4 w-4 transition-transform ${appsOpen ? "rotate-180" : ""}`} />
            </button>
          </CardHeader>
          <div style={{ maxHeight: appsOpen ? "4000px" : "0px", overflow: "hidden", transition: "max-height 360ms ease" }}>
            <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Sr. No.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Recruiter</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {submissions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No applications yet</TableCell>
                    </TableRow>
                  ) : (
                  submissions?.map((s: any, idx: number) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{(applicationsPage - 1) * APPLICATIONS_PAGE_SIZE + idx + 1}</TableCell>
                      <TableCell className="font-medium">{s.client_name}</TableCell>
                      <TableCell>{s.position}</TableCell>
                      <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{displayRecruiterName(s.recruiter_id ?? null)}</TableCell>
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
            {submissionsTotal > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {(applicationsPage - 1) * APPLICATIONS_PAGE_SIZE + 1}–{Math.min(applicationsPage * APPLICATIONS_PAGE_SIZE, submissionsTotal)} of {submissionsTotal}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setApplicationsPage((p) => Math.max(1, p - 1))} disabled={applicationsPage <= 1}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Select value={String(applicationsPage)} onValueChange={(v) => setApplicationsPage(Number(v))}>
                    <SelectTrigger className="w-[7rem] h-8">
                      <SelectValue>Page {applicationsPage} of {applicationsTotalPages}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: applicationsTotalPages }, (_, i) => i + 1).map((p) => (
                        <SelectItem key={p} value={String(p)}>Page {p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => setApplicationsPage((p) => Math.min(applicationsTotalPages, p + 1))} disabled={applicationsPage >= applicationsTotalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            </CardContent>
          </div>
        </Card>

        {/* Education & Experience lists */}
          <Card>
            <CardHeader className="relative">
              <CardTitle className="text-base">Education</CardTitle>
              <button type="button" className="absolute right-3 top-3 p-1 rounded hover:bg-muted" onClick={() => setEduOpen(v => !v)} aria-label="Toggle education">
                <ChevronDown className={`h-4 w-4 transition-transform ${eduOpen ? 'rotate-180' : ''}`} />
              </button>
            </CardHeader>
            <div style={{ maxHeight: eduOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height 320ms ease' }}>
              <CardContent className="space-y-4">
              {educations?.length === 0 ? <div className="text-muted-foreground">No education added</div> : educations.map((e: any) => (
                <div key={e.id} className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{e.degree} — {e.institution}</div>
                    <div className="text-sm text-muted-foreground">{e.graduation_year || ""}</div>
                    {e.notes && <div className="text-sm whitespace-pre-wrap">{e.notes}</div>}
                  </div>
                  {(isOwnProfile || isAdmin) && <Button variant="ghost" size="sm" onClick={() => deleteEducationMutation.mutate(e.id)}>Delete</Button>}
                </div>
              ))}
              {(isOwnProfile || isAdmin) && (
                <form onSubmit={async (ev) => {
                  ev.preventDefault();
                  const fd = new FormData(ev.currentTarget);
                  await createEducationMutation.mutateAsync({
                    degree: fd.get("degree") as string,
                    institution: fd.get("institution") as string,
                    field_of_study: fd.get("field_of_study") as string,
                    start_date: fd.get("start_date") as string || null,
                    end_date: fd.get("end_date") as string || null,
                    graduation_year: fd.get("graduation_year") as string || null,
                    notes: fd.get("notes") as string || null,
                  });
                  (ev.currentTarget as HTMLFormElement).reset();
                }} className="grid grid-cols-2 gap-4">
                  <Select name="degree" defaultValue="">
                    <SelectTrigger><SelectValue placeholder="Select degree" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HighSchool Diploma">HighSchool Diploma</SelectItem>
                      <SelectItem value="Associate Degree">Associate Degree</SelectItem>
                      <SelectItem value="Bachelors">Bachelors</SelectItem>
                      <SelectItem value="Masters">Masters</SelectItem>
                      <SelectItem value="PhD">PhD</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input name="institution" placeholder="Institution/College" />
                  <Input name="field_of_study" placeholder="Major" />
                  <Input name="graduation_year" placeholder="Graduation year" />
                  <Input name="start_date" type="date" />
                  <Input name="end_date" type="date" />
                  <Textarea name="notes" />
                  <div className="col-span-2"><Button type="submit">Add Education</Button></div>
                </form>
              )}
            </CardContent>
            </div>
          </Card>

          <Card className="mt-4">
            <CardHeader className="relative">
              <CardTitle className="text-base">Experience</CardTitle>
              <button type="button" className="absolute right-3 top-3 p-1 rounded hover:bg-muted" onClick={() => setExpOpen(v => !v)} aria-label="Toggle experience">
                <ChevronDown className={`h-4 w-4 transition-transform ${expOpen ? 'rotate-180' : ''}`} />
              </button>
            </CardHeader>
            <div style={{ maxHeight: expOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height 320ms ease' }}>
              <CardContent className="space-y-4">
              {experiences?.length === 0 ? <div className="text-muted-foreground">No experience added</div> : experiences.map((ex: any) => (
                <div key={ex.id} className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{ex.role} @ {ex.company}</div>
                    <div className="text-sm text-muted-foreground">{ex.start_date ? new Date(ex.start_date).toLocaleDateString() : ""} — {ex.current ? "Present" : (ex.end_date ? new Date(ex.end_date).toLocaleDateString() : "")}</div>
                    {ex.technologies && <div className="text-sm">Tech: {ex.technologies}</div>}
                    {ex.responsibilities && <div className="text-sm whitespace-pre-wrap">{ex.responsibilities}</div>}
                  </div>
                  {(isOwnProfile || isAdmin) && <Button variant="ghost" size="sm" onClick={() => deleteExperienceMutation.mutate(ex.id)}>Delete</Button>}
                </div>
              ))}
              {(isOwnProfile || isAdmin) && (
                <form onSubmit={async (ev) => {
                  ev.preventDefault();
                  const fd = new FormData(ev.currentTarget);
                  await createExperienceMutation.mutateAsync({
                    company: fd.get("company") as string,
                    role: fd.get("role") as string,
                    start_date: fd.get("start_date") as string || null,
                    end_date: fd.get("end_date") as string || null,
                    current: fd.get("current") === "on",
                    technologies: fd.get("technologies") as string || null,
                    responsibilities: fd.get("responsibilities") as string || null,
                  });
                  (ev.currentTarget as HTMLFormElement).reset();
                }} className="grid grid-cols-2 gap-4">
                  <Input name="company" placeholder="Company" />
                  <Input name="role" placeholder="Role" />
                  <Input name="start_date" type="date" />
                  <Input name="end_date" type="date" />
                  <div className="flex items-center gap-2"><input name="current" type="checkbox" /> <Label>Current</Label></div>
                  <Input name="technologies" placeholder="Technologies (comma separated)" />
                  <Textarea name="responsibilities" />
                  <div className="col-span-2"><Button type="submit">Add Experience</Button></div>
                </form>
              )}
            </CardContent>
            </div>
          </Card>
        {/* Marketing Details — only available when Basic + Professional + at least 1 Education + 1 Experience */}
        <Card className="mt-4">
            <CardHeader className="relative">
              <CardTitle className="text-base">Marketing Details</CardTitle>
              <button type="button" className="absolute right-3 top-3 p-1 rounded hover:bg-muted" onClick={() => setMarketingOpen((v) => !v)} aria-label="Toggle marketing details">
                <ChevronDown className={`h-4 w-4 transition-transform ${marketingOpen ? 'rotate-180' : ''}`} />
              </button>
            </CardHeader>
            <div style={{ maxHeight: marketingOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height 320ms ease' }}>
              <CardContent className="space-y-4">
              {!canAddMarketingDetails && (
                <div className="p-4 rounded bg-muted text-muted-foreground text-sm">
                  Complete Basic details, Professional details, and add at least one Education and one Experience to unlock Marketing Details.
                </div>
              )}
              {canAddMarketingDetails && isOwnProfile && marketingSubmittedLocal ? (
                <div className="p-4 bg-green-50 rounded">Thank you — you are ready for marketing.</div>
              ) : null}
              {canAddMarketingDetails && (<><div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GMail</Label>
                  {(isOwnProfile || isAdmin || isManager) ? <Input value={marketingGmail} onChange={(e) => setMarketingGmail(e.target.value)} disabled={isOwnProfile && marketingSubmittedLocal} /> : ((isRecruiter) ? <div className="text-sm">{marketingGmail || "—"}</div> : null)}
                </div>
                <div className="space-y-2">
                  <Label>GMail Password</Label>
                  {(isOwnProfile || isAdmin || isManager) ? (
                    <div className="relative">
                      <Input type={showGmailPass ? "text" : "password"} value={marketingGmailPass} onChange={(e) => setMarketingGmailPass(e.target.value)} disabled={isOwnProfile && marketingSubmittedLocal} className="pr-9" />
                      <button type="button" onClick={() => setShowGmailPass((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showGmailPass ? "Hide password" : "Show password"}>
                        {showGmailPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : isRecruiter ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={showGmailPass ? "" : "font-mono"}>{showGmailPass ? (marketingGmailPass || "—") : (marketingGmailPass ? "••••••••" : "—")}</span>
                      <button type="button" onClick={() => setShowGmailPass((v) => !v)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={showGmailPass ? "Hide password" : "Show password"}>{showGmailPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                  ) : (isAdmin || isManager) ? <div className="text-sm">{marketingGmailPass || "—"}</div> : null}
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  {(isOwnProfile || isAdmin || isManager) ? <Input value={marketingLinkedIn} onChange={(e) => setMarketingLinkedIn(e.target.value)} disabled={isOwnProfile && marketingSubmittedLocal} /> : ((isRecruiter) ? <div className="text-sm">{marketingLinkedIn || "—"}</div> : null)}
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn Password</Label>
                  {(isOwnProfile || isAdmin || isManager) ? (
                    <div className="relative">
                      <Input type={showLinkedInPass ? "text" : "password"} value={marketingLinkedInPass} onChange={(e) => setMarketingLinkedInPass(e.target.value)} disabled={isOwnProfile && marketingSubmittedLocal} className="pr-9" />
                      <button type="button" onClick={() => setShowLinkedInPass((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showLinkedInPass ? "Hide password" : "Show password"}>
                        {showLinkedInPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : isRecruiter ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={showLinkedInPass ? "" : "font-mono"}>{showLinkedInPass ? (marketingLinkedInPass || "—") : (marketingLinkedInPass ? "••••••••" : "—")}</span>
                      <button type="button" onClick={() => setShowLinkedInPass((v) => !v)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={showLinkedInPass ? "Hide password" : "Show password"}>{showLinkedInPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                  ) : (isAdmin || isManager) ? <div className="text-sm">{marketingLinkedInPass || "—"}</div> : null}
                </div>
                <div className="space-y-2">
                  <Label>GoVoice</Label>
                  {(isOwnProfile || isAdmin || isManager) ? <Input value={marketingGoVoice} onChange={(e) => setMarketingGoVoice(e.target.value)} disabled={isOwnProfile && marketingSubmittedLocal} /> : ((isRecruiter) ? <div className="text-sm">{marketingGoVoice || "—"}</div> : null)}
                </div>
                <div className="space-y-2">
                  <Label>GoVoice Password</Label>
                  {(isOwnProfile || isAdmin || isManager) ? (
                    <div className="relative">
                      <Input type={showGoVoicePass ? "text" : "password"} value={marketingGoVoicePass} onChange={(e) => setMarketingGoVoicePass(e.target.value)} disabled={isOwnProfile && marketingSubmittedLocal} className="pr-9" />
                      <button type="button" onClick={() => setShowGoVoicePass((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showGoVoicePass ? "Hide password" : "Show password"}>
                        {showGoVoicePass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : isRecruiter ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={showGoVoicePass ? "" : "font-mono"}>{showGoVoicePass ? (marketingGoVoicePass || "—") : (marketingGoVoicePass ? "••••••••" : "—")}</span>
                      <button type="button" onClick={() => setShowGoVoicePass((v) => !v)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={showGoVoicePass ? "Hide password" : "Show password"}>{showGoVoicePass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    </div>
                  ) : (isAdmin || isManager) ? <div className="text-sm">{marketingGoVoicePass || "—"}</div> : null}
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Other Marketing Notes</Label>
                  {(isOwnProfile || isAdmin || isManager) ? <Textarea value={marketingOther} onChange={(e) => setMarketingOther(e.target.value)} disabled={isOwnProfile && marketingSubmittedLocal} /> : ((isRecruiter) ? <div className="text-sm whitespace-pre-wrap">{marketingOther || "—"}</div> : null)}
                </div>
              </div>
              {(isAdmin || isManager) && !isOwnProfile && (
                <div className="flex gap-2">
                  <Button
                    disabled={updateCandidate.isPending}
                    onClick={async () => {
                      try {
                        await updateCandidate.mutateAsync({
                          marketing_gmail: marketingGmail || null,
                          marketing_gmail_pass: marketingGmailPass || null,
                          marketing_linkedin: marketingLinkedIn || null,
                          marketing_linkedin_pass: marketingLinkedInPass || null,
                          marketing_govoice: marketingGoVoice || null,
                          marketing_govoice_pass: marketingGoVoicePass || null,
                          marketing_other: marketingOther || null,
                        });
                        toast.success("Marketing details saved.");
                      } catch {
                        toast.error("Failed to save marketing details");
                      }
                    }}
                  >
                    {updateCandidate.isPending ? "Saving..." : "Save Marketing Details"}
                  </Button>
                </div>
              )}
              {isOwnProfile && !marketingSubmittedLocal && (
                <div className="flex gap-2">
                  <Button
                    disabled={marketingSubmitting}
                    onClick={async () => {
                      setMarketingSubmitting(true);
                      try {
                        // Validate required basic, professional, education and experience details
                        const missing: string[] = [];
                        if (!candidate?.first_name) missing.push("First name");
                        if (!candidate?.email) missing.push("Email");
                        if (!candidate?.phone) missing.push("Phone");

                        if (!degree) missing.push("Degree");
                        if (!technology) missing.push("Technology");
                        if (experienceYears === "" || experienceYears === null) missing.push("Experience (years)");
                        if (!primarySkills) missing.push("Primary skills");
                        if (!targetRole) missing.push("Target role");
                        if (!expectedSalaryLocal) missing.push("Expected salary");
                        if (!interviewAvailability) missing.push("Interview availability");

                        if (!educations || (educations || []).length === 0) missing.push("Education");
                        if (!experiences || (experiences || []).length === 0) missing.push("Experience");

                        if (missing.length > 0) {
                          toast.error(`Please provide: ${missing.join(", ")}`);
                          setMarketingSubmitting(false);
                          return;
                        }

                        // 1) Save marketing fields (do NOT mark submitted yet)
                        await updateCandidate.mutateAsync({
                          marketing_gmail: marketingGmail || null,
                          marketing_gmail_pass: marketingGmailPass || null,
                          marketing_linkedin: marketingLinkedIn || null,
                          marketing_linkedin_pass: marketingLinkedInPass || null,
                          marketing_govoice: marketingGoVoice || null,
                          marketing_govoice_pass: marketingGoVoicePass || null,
                          marketing_other: marketingOther || null,
                        });

                        // 2) Only after save succeeds, call the webhook to notify admins/managers
                        const webhook = import.meta.env.VITE_MARKETING_WEBHOOK as string | undefined;
                        if (webhook) {
                          try {
                            const roles = await fetchAllUserRoles();
                            const adminManagerUserIds = (roles || []).filter((r: any) => r.role === "admin" || r.role === "manager").map((r: any) => r.user_id);
                            let recipients: string[] = [];
                            if (adminManagerUserIds.length > 0) {
                              const profiles = await fetchProfilesBySelect("user_id, full_name, email");
                              recipients = (profiles || []).filter((p: any) => adminManagerUserIds.includes(p.user_id)).map((p: any) => p.email).filter(Boolean);
                            }

                            await fetch(webhook, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: candidate.id,
                                name: `${candidate.first_name} ${candidate.last_name || ""}`,
                                email: candidate.email || null,
                                profile_link: `${window.location.origin}/candidates/${candidate.id}`,
                                technology: technology || null,
                                experience_years: typeof experienceYears === "string" ? null : experienceYears,
                                primary_skills: primarySkills || null,
                                expected_salary: expectedSalaryLocal ? Number(expectedSalaryLocal) : null,
                                recipients,
                              }),
                            });
                          } catch (err) {
                            // If webhook failed, surface error and do not mark submitted
                            throw new Error("Failed to notify admins after saving — please try again.");
                          }
                        }

                        // 3) Mark marketing_submitted only after webhook succeeded
                        await updateCandidate.mutateAsync({
                          marketing_submitted: true,
                          marketing_submitted_at: new Date().toISOString(),
                        });

                        setMarketingSubmittedLocal(true);
                        toast.success("Thank you — your marketing details were saved and notified to the team.");
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to submit marketing details");
                      } finally {
                        setMarketingSubmitting(false);
                      }
                    }}
                  >
                    {marketingSubmitting ? "Submitting..." : "Submit Marketing Details"}
                  </Button>
                </div>
              )}
              {isOwnProfile && marketingSubmittedLocal && (
                <div className="text-sm text-muted-foreground">You have submitted marketing details and cannot edit them. Contact your recruiter to request changes.</div>
              )}
              </>)}
            </CardContent>
            </div>
          </Card>
      </div>
      </div>
    );
  } catch (err) {
    console.error("CandidateDetail render error:", err);
    return (
      <div className="py-12 text-center text-destructive">
        Something went wrong rendering the candidate page. Please check the console for errors.
      </div>
    );
  }
}
