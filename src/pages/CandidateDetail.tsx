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
import { ArrowLeft, Plus, FileText, Calendar, Pencil, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import ResumeUpload from "@/components/ResumeUpload";
import CoverLetterUpload from "@/components/CoverLetterUpload";
import DocumentUpload from "@/components/DocumentUpload";
import { fetchCandidateById, updateCandidateStatus, updateCandidate as updateCandidateFn } from "../../dbscripts/functions/candidates";
import { fetchEducationsByCandidate, createEducation, deleteEducation } from "../../dbscripts/functions/educations";
import { fetchExperiencesByCandidate, createExperience, deleteExperience } from "../../dbscripts/functions/experiences";
import { fetchSubmissionsByCandidate, createSubmission as createSubmissionFn } from "../../dbscripts/functions/submissions";
import { fetchProfileName, fetchProfilesBySelect, fetchProfilesByRole } from "../../dbscripts/functions/profiles";
import { fetchAllUserRoles } from "../../dbscripts/functions/userRoles";

const CANDIDATE_STATUSES = ["New", "In Marketing", "Placed", "Backout", "On Bench", "In Training"] as const;
const VISA_STATUSES = ["CPT", "OPT", "STEM OPT", "H1-B", "H4-EAD", "GC-EAD", "Green Card", "US Citizen", "Other"] as const;

const MASK = "*******";

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isAdmin, isRecruiter, isCandidate, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVisa, setEditVisa] = useState("Other");
  const [editVisaCopyUploaded, setEditVisaCopyUploaded] = useState(false);
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");
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
  // collapse states for sections
  const [profOpen, setProfOpen] = useState(false);
  const [eduOpen, setEduOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);

  const isOwnProfile = isCandidate && profile?.linked_candidate_id === id;
  if (isCandidate && !isOwnProfile) return <Navigate to="/" replace />;

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => fetchCandidateById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (candidate) setEditVisa(candidate.visa_status || "Other");
    if (candidate) {
      setEditCity((candidate as any).city || "");
      setEditState((candidate as any).state || "");
      setEditZip((candidate as any).zip || "");
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
  }, [candidate?.visa_status]);

  const { data: submissions } = useQuery({
    queryKey: ["candidate-submissions", id],
    queryFn: () => fetchSubmissionsByCandidate(id!),
    enabled: !!id,
  });
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
    queryKey: ["recruiters"],
    queryFn: () => fetchProfilesByRole("recruiter"),
    enabled: isAdmin && !!candidate,
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

  const createEducationMutation = useMutation({
    mutationFn: async (payload: any) => {
      await createEducation({ candidate_id: id!, ...payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-educations", id] });
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

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!candidate) {
    return <div className="text-center text-muted-foreground py-12">Candidate not found</div>;
  }

  // Only admins and the candidate themselves can see personal contact details.
  const canSeePersonalDetails = isAdmin || isOwnProfile;
  const displayEmail = canSeePersonalDetails ? (candidate.email || "—") : "—";
  const displayPhone = canSeePersonalDetails ? (candidate.phone || "—") : "—";
  const showVisaStatus = isAdmin || isRecruiter || isOwnProfile;

  try {
    return (
      <div>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to={isCandidate ? "/" : "/candidates"}><ArrowLeft className="mr-2 h-4 w-4" />{isCandidate ? "Back to Dashboard" : "Back to Candidates"}</Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <CardTitle className="text-lg">{candidate.first_name} {candidate.last_name || ""}</CardTitle>
            {isAdmin && (
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit candidate</DialogTitle></DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      // if visa status requires copy, ensure we have one
                      if (editVisa !== "GC" && editVisa !== "Citizen") {
                        const hasExisting = Boolean((candidate as any).visa_copy_url);
                        const uploaded = Boolean(editVisaCopyUploaded);
                        if (!hasExisting && !uploaded) {
                          toast.error("Visa copy is required for the selected visa status");
                          return;
                        }
                      }
                      const fd = new FormData(e.currentTarget);
                      updateCandidate.mutate(
                        {
                          first_name: fd.get("first_name") as string,
                          last_name: (fd.get("last_name") as string) || null,
                          email: (fd.get("email") as string) || null,
                          phone: (fd.get("phone") as string) || null,
                          visa_status: editVisa,
                          city: editCity || null,
                          state: editState || null,
                          zip: editZip || null,
                        },
                        { onSuccess: () => { setEditDialogOpen(false); queryClient.invalidateQueries({ queryKey: ["candidate", id] }); } }
                      );
                    }}
                  >
                    <div className="space-y-2">
                      <Label>First name *</Label>
                      <Input name="first_name" defaultValue={candidate.first_name} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Last name</Label>
                      <Input name="last_name" defaultValue={candidate.last_name || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input name="email" type="email" defaultValue={candidate.email || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input name="phone" defaultValue={candidate.phone || ""} required />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input name="city" value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input name="state" value={editState} onChange={(e) => setEditState(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Zip</Label>
                        <Input name="zip" value={editZip} onChange={(e) => setEditZip(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Visa status</Label>
                      <Select value={editVisa} onValueChange={setEditVisa}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VISA_STATUSES.map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {editVisa !== "US Citizen" && (
                      <div className="space-y-2">
                        <Label>Visa Copy</Label>
                        <DocumentUpload
                          candidateId={candidate.id}
                          currentUrl={(candidate as any).visa_copy_url || null}
                          folder="visa"
                          onUploaded={() => {
                            setEditVisaCopyUploaded(true);
                            queryClient.invalidateQueries({ queryKey: ["candidate", id] });
                          }}
                        />
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={updateCandidate.isPending}>Save</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
            <CardContent className="space-y-3 text-sm">
            {((isAdmin || isOwnProfile) || (!isRecruiter && Boolean(candidate.email))) && (
              <div><span className="text-muted-foreground">Email:</span> {displayEmail}</div>
            )}
            {((isAdmin || isOwnProfile) || (!isRecruiter && Boolean(candidate.phone))) && (
              <div><span className="text-muted-foreground">Phone:</span> {displayPhone}</div>
            )}
            {isAdmin && recruiters && (
              <div className="space-y-1">
                <Label className="text-muted-foreground">Assign recruiter</Label>
                <Select
                  value={candidate.recruiter_id || "unassigned"}
                  onValueChange={(v) => updateCandidate.mutate({ recruiter_id: v === "unassigned" ? null : v })}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select recruiter" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {recruiters.map((r: any) => (
                      <SelectItem key={r.user_id} value={r.user_id}>{r.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isAdmin && (
              <div><span className="text-muted-foreground">Recruiter:</span> {recruiterProfile?.full_name || "—"}</div>
            )}
            {showVisaStatus && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Visa status:</span>
                {isOwnProfile ? (
                  <Select value={editVisa} onValueChange={async (v) => {
                    setEditVisa(v);
                    try {
                      await updateCandidate.mutateAsync({ visa_status: v });
                    } catch {
                      /* handled by mutation */
                    }
                  }}>
                    <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VISA_STATUSES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span>{candidate.visa_status || "—"}</span>
                )}

                {((candidate as any).visa_copy_url && (candidate.visa_status !== "US Citizen")) ? (
                  <a href={(candidate as any).visa_copy_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-info" title="Download visa copy">
                    <Download className="h-4 w-4" />
                  </a>
                ) : null}
                {/* Visa copy upload for own profile (only if not US Citizen and not already uploaded) */}
                {isOwnProfile && editVisa !== "US Citizen" && !(candidate as any).visa_copy_url && (
                  <div className="ml-2">
                    <DocumentUpload
                      candidateId={candidate.id}
                      currentUrl={null}
                      folder="visa"
                      onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                    />
                  </div>
                )}
              </div>
            )}
            {/* Resume upload moved to Professional Details */}
            <div className="pt-2">
              <Label className="text-muted-foreground">ID Proof</Label>
              {((candidate as any).id_copy_url) ? (
                <a href={(candidate as any).id_copy_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-info underline">View</a>
              ) : ((isAdmin || isOwnProfile) ? (
                <DocumentUpload
                  candidateId={candidate.id}
                  currentUrl={null}
                  folder="id"
                  onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                />
              ) : (
                <span className="ml-2 text-xs text-muted-foreground">—</span>
              ))}
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
              <FileText className="h-4 w-4" /> Applications ({submissions?.length || 0})
            </CardTitle>
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
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No applications yet</TableCell>
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
        {/* Professional Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="relative">
              <CardTitle className="text-base">Professional Details</CardTitle>
              <button type="button" className="absolute right-3 top-3 p-1 rounded hover:bg-muted" onClick={() => setProfOpen(v => !v)} aria-label="Toggle professional details">
                <ChevronDown className={`h-4 w-4 transition-transform ${profOpen ? 'rotate-180' : ''}`} />
              </button>
            </CardHeader>
            <div style={{ maxHeight: profOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height 320ms ease' }}>
              <CardContent className="space-y-4">
              {/* Resume & Cover Letter Upload */}
              <div className="flex gap-4 items-center">
                <div><span className="text-muted-foreground">Resume:</span></div>
                <div>
                  {(isOwnProfile || isAdmin) ? (
                    <ResumeUpload
                      candidateId={candidate.id}
                      currentUrl={candidate.resume_url}
                      onUploaded={(url: string) => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                    />
                  ) : ((isAdmin || isManager || isRecruiter || isOwnProfile) ? (
                    candidate.resume_url ? <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-info underline">View Resume</a> : <span className="ml-2 text-xs text-muted-foreground">—</span>
                  ) : <span className="ml-2 text-xs text-muted-foreground">—</span>)}
                </div>
                <div className="ml-6"><span className="text-muted-foreground">Cover Letter:</span></div>
                <div>
                  {(isOwnProfile || isAdmin) ? (
                    <CoverLetterUpload
                      candidateId={candidate.id}
                      currentUrl={(candidate as any).cover_letter_url || null}
                      onUploaded={(url: string) => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                    />
                  ) : ((isAdmin || isManager || isRecruiter || isOwnProfile) ? (
                    (candidate as any).cover_letter_url ? <a href={(candidate as any).cover_letter_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-info underline">View Cover Letter</a> : <span className="ml-2 text-xs text-muted-foreground">—</span>
                  ) : <span className="ml-2 text-xs text-muted-foreground">—</span>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Technology</Label>
                  {isOwnProfile ? <Input value={technology} onChange={(e) => setTechnology(e.target.value)} /> : <div className="text-sm">{technology || "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Experience (years)</Label>
                  {isOwnProfile ? <Input type="number" value={experienceYears as any} onChange={(e) => setExperienceYears(e.target.value === "" ? "" : Number(e.target.value))} /> : <div className="text-sm">{experienceYears || "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Primary Skills</Label>
                  {isOwnProfile ? <Input value={primarySkills} onChange={(e) => setPrimarySkills(e.target.value)} /> : <div className="text-sm">{primarySkills || "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Target Role</Label>
                  {isOwnProfile ? <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} /> : <div className="text-sm">{targetRole || "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Expected Salary</Label>
                  {isOwnProfile ? <Input type="number" value={expectedSalaryLocal} onChange={(e) => setExpectedSalaryLocal(e.target.value)} /> : <div className="text-sm">{expectedSalaryLocal ? `$${Number(expectedSalaryLocal).toLocaleString()}` : "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Interview Availability</Label>
                  {isOwnProfile ? <Input value={interviewAvailability} onChange={(e) => setInterviewAvailability(e.target.value)} /> : <div className="text-sm">{interviewAvailability || "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Open to Relocate</Label>
                  {isOwnProfile ? <Select value={openToRelocateLocal ? "yes" : "no"} onValueChange={(v) => setOpenToRelocateLocal(v === "yes")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select> : <div className="text-sm">{openToRelocateLocal ? "Yes" : "No"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Client 1 (Recent)</Label>
                  {isOwnProfile ? <Input value={client1} onChange={(e) => setClient1(e.target.value)} /> : <div className="text-sm">{client1 || "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Client 2 (Past)</Label>
                  {isOwnProfile ? <Input value={client2} onChange={(e) => setClient2(e.target.value)} /> : <div className="text-sm">{client2 || "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Reference 1</Label>
                  {isOwnProfile ? <Input value={reference1} onChange={(e) => setReference1(e.target.value)} /> : <div className="text-sm">{reference1 || "—"}</div>}
                </div>
                <div className="space-y-2">
                  <Label>Reference 2</Label>
                  {isOwnProfile ? <Input value={reference2} onChange={(e) => setReference2(e.target.value)} /> : <div className="text-sm">{reference2 || "—"}</div>}
                </div>
                {/* Cover Letter is handled above by the upload component */}
              </div>
              {isOwnProfile && (
                <div className="flex gap-2">
                  <Button onClick={async () => {
                    // Validate mandatory professional fields
                    if (!degree || degree === "") { toast.error("Degree is required"); return; }
                    if (!technology || technology.trim() === "") { toast.error("Technology is required"); return; }
                    if (experienceYears === "" || experienceYears === null) { toast.error("Experience (years) is required"); return; }
                    if (!primarySkills || primarySkills.trim() === "") { toast.error("Primary skills are required"); return; }
                    if (!targetRole || targetRole.trim() === "") { toast.error("Target role is required"); return; }
                    if (!expectedSalaryLocal || expectedSalaryLocal.trim() === "") { toast.error("Expected salary is required"); return; }
                    if (!interviewAvailability || interviewAvailability.trim() === "") { toast.error("Interview availability is required"); return; }
                    try {
                      await updateCandidate.mutateAsync({
                        degree, institution, graduation_year: graduationYear,
                        technology, experience_years: typeof experienceYears === "string" ? null : experienceYears,
                        primary_skills: primarySkills, target_role: targetRole,
                        expected_salary: expectedSalaryLocal ? Number(expectedSalaryLocal) : null,
                        interview_availability: interviewAvailability, open_to_relocate: openToRelocateLocal,
                        client1, client2, reference1, reference2,
                      });
                    } catch {
                      /* handled by mutation */
                    }
                  }}>Save Professional Details</Button>
                </div>
              )}
              </CardContent>
            </div>
          </Card>
        </div>
        {/* Education & Experience lists */}
        <div className="lg:col-span-2">
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
                  {isOwnProfile && <Button variant="ghost" size="sm" onClick={() => deleteEducationMutation.mutate(e.id)}>Delete</Button>}
                </div>
              ))}
              {isOwnProfile && (
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
                  {isOwnProfile && <Button variant="ghost" size="sm" onClick={() => deleteExperienceMutation.mutate(ex.id)}>Delete</Button>}
                </div>
              ))}
              {isOwnProfile && (
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
        </div>
        {/* Marketing Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="relative">
              <CardTitle className="text-base">Marketing Details</CardTitle>
              <button type="button" className="absolute right-3 top-3 p-1 rounded hover:bg-muted" onClick={() => setMarketingOpen(v => !v)} aria-label="Toggle marketing details">
                <ChevronDown className={`h-4 w-4 transition-transform ${marketingOpen ? 'rotate-180' : ''}`} />
              </button>
            </CardHeader>
            <div style={{ maxHeight: marketingOpen ? '2000px' : '0px', overflow: 'hidden', transition: 'max-height 320ms ease' }}>
              <CardContent className="space-y-4">
              {isOwnProfile && marketingSubmittedLocal ? (
                <div className="p-4 bg-green-50 rounded">Thank you — you are ready for marketing.</div>
              ) : null}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GMail</Label>
                  {isOwnProfile ? <Input value={marketingGmail} onChange={(e) => setMarketingGmail(e.target.value)} disabled={marketingSubmittedLocal} /> : ((isAdmin || isManager || isRecruiter) ? <div className="text-sm">{marketingGmail || "—"}</div> : null)}
                </div>
                <div className="space-y-2">
                  <Label>GMail Password</Label>
                  {isOwnProfile ? <Input value={marketingGmailPass} onChange={(e) => setMarketingGmailPass(e.target.value)} disabled={marketingSubmittedLocal} /> : ((isAdmin || isManager) ? <div className="text-sm">{marketingGmailPass || "—"}</div> : null)}
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  {isOwnProfile ? <Input value={marketingLinkedIn} onChange={(e) => setMarketingLinkedIn(e.target.value)} disabled={marketingSubmittedLocal} /> : ((isAdmin || isManager || isRecruiter) ? <div className="text-sm">{marketingLinkedIn || "—"}</div> : null)}
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn Password</Label>
                  {isOwnProfile ? <Input value={marketingLinkedInPass} onChange={(e) => setMarketingLinkedInPass(e.target.value)} disabled={marketingSubmittedLocal} /> : ((isAdmin || isManager) ? <div className="text-sm">{marketingLinkedInPass || "—"}</div> : null)}
                </div>
                <div className="space-y-2">
                  <Label>GoVoice</Label>
                  {isOwnProfile ? <Input value={marketingGoVoice} onChange={(e) => setMarketingGoVoice(e.target.value)} disabled={marketingSubmittedLocal} /> : ((isAdmin || isManager || isRecruiter) ? <div className="text-sm">{marketingGoVoice || "—"}</div> : null)}
                </div>
                <div className="space-y-2">
                  <Label>GoVoice Password</Label>
                  {isOwnProfile ? <Input value={marketingGoVoicePass} onChange={(e) => setMarketingGoVoicePass(e.target.value)} disabled={marketingSubmittedLocal} /> : ((isAdmin || isManager) ? <div className="text-sm">{marketingGoVoicePass || "—"}</div> : null)}
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Other Marketing Notes</Label>
                  {isOwnProfile ? <Textarea value={marketingOther} onChange={(e) => setMarketingOther(e.target.value)} disabled={marketingSubmittedLocal} /> : ((isAdmin || isManager || isRecruiter) ? <div className="text-sm whitespace-pre-wrap">{marketingOther || "—"}</div> : null)}
                </div>
              </div>
              {isOwnProfile && !marketingSubmittedLocal && (
                <div className="flex gap-2">
                  <Button onClick={async () => {
                    try {
                      await updateCandidate.mutateAsync({
                        marketing_gmail: marketingGmail || null,
                        marketing_gmail_pass: marketingGmailPass || null,
                        marketing_linkedin: marketingLinkedIn || null,
                        marketing_linkedin_pass: marketingLinkedInPass || null,
                        marketing_govoice: marketingGoVoice || null,
                        marketing_govoice_pass: marketingGoVoicePass || null,
                        marketing_other: marketingOther || null,
                        marketing_submitted: true,
                        marketing_submitted_at: new Date().toISOString(),
                      });
                      setMarketingSubmittedLocal(true);
                      // call webhook to notify admin/manager (include key professional fields)
                      const webhook = import.meta.env.VITE_MARKETING_WEBHOOK as string | undefined;
                      if (webhook) {
                        // fetch admin/manager emails to include as recipients
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
                          // fallback to original payload if role fetch fails
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
                            }),
                          });
                        }
                      }
                      toast.success("Marketing details submitted");
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to submit marketing details");
                    }
                  }}>Submit Marketing Details</Button>
                </div>
              )}
              {isOwnProfile && marketingSubmittedLocal && (
                <div className="text-sm text-muted-foreground">You have submitted marketing details and cannot edit them. Contact your recruiter to request changes.</div>
              )}
            </CardContent>
            </div>
          </Card>
        </div>
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
