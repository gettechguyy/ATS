import { useState } from "react";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchSubmissions, fetchSubmissionsByRecruiter, fetchSubmissionsByCandidate, fetchSubmissionsByTeamLead, updateSubmissionStatus, updateSubmission, createSubmission as createSubmissionFn } from "../../dbscripts/functions/submissions";
import { fetchCandidates, fetchCandidatesByRecruiter } from "../../dbscripts/functions/candidates";
import { uploadScreenCallFile, uploadVendorJobDescription } from "../../dbscripts/functions/storage";
import { US_STATES } from "@/lib/usStates";

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
  const { user, profile, role, isCandidate, isRecruiter, isAdmin, isManager, isTeamLead } = useAuth();
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCandidateId, setNewCandidateId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newJobPortal, setNewJobPortal] = useState("");
  const [newJobLink, setNewJobLink] = useState("");

  const submissionsQueryFn = async () => {
    if (isCandidate) {
      if (!profile?.linked_candidate_id) return [];
      return fetchSubmissionsByCandidate(profile.linked_candidate_id);
    }
    if (isRecruiter && user?.id) return fetchSubmissionsByRecruiter(user.id);
    if (isTeamLead && profile?.id) return fetchSubmissionsByTeamLead(profile.id);
    return fetchSubmissions();
  };

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["submissions", role, user?.id, profile?.linked_candidate_id],
    queryFn: submissionsQueryFn,
  });

  // fetch candidates for Add Application dropdown
  const candidatesQueryFn = async () => {
    // Admins and managers see all candidates (no filter)
    if (isAdmin || isManager) return fetchCandidates();
    // Recruiters see only candidates assigned to them
    if (isRecruiter && user?.id) return fetchCandidatesByRecruiter(user.id);
    // Others: empty
    return [];
  };

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["candidates-dropdown", role, user?.id],
    queryFn: candidatesQueryFn,
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      toast.success("Submission updated");
      setVendorDialogOpen(false);
      setVendorSubmission(null);
      setRate("");
      setJobDescription("");
      setJobType("Remote");
      setCity("");
      setStateValue("");
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

  const filtered = submissions?.filter((s: any) => {
    const candidateName = `${s.candidates?.first_name || ""} ${s.candidates?.last_name || ""}`.toLowerCase();
    const matchSearch =
      s.client_name.toLowerCase().includes(search.toLowerCase()) ||
      s.position.toLowerCase().includes(search.toLowerCase()) ||
      candidateName.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

 

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
          {(isAdmin || isRecruiter) && (
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
                  setAddDialogOpen(true);
                }}
                disabled={candidatesLoading || (isRecruiter && (!candidates || candidates.length === 0))}
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
                  {!isCandidate && <TableHead>Candidate</TableHead>}
                  <TableHead>Client</TableHead>
                  <TableHead>Position</TableHead>
                  {isCandidate ? (
                    <>
                      <TableHead>Job Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No applications found</TableCell>
                  </TableRow>
                ) : (
                  filtered?.map((s: any) => (
                  <TableRow key={s.id}>
                      {!isCandidate && <TableCell className="font-medium">{s.candidates?.first_name} {s.candidates?.last_name || ""}</TableCell>}
                      <TableCell>{s.client_name}</TableCell>
                      <TableCell>{s.position}</TableCell>
                      {isCandidate ? (
                        <>
                          <TableCell className="text-muted-foreground">{s.job_type || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{s.city ? `${s.city}${s.state ? `, ${s.state}` : ""}` : "—"}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[s.status] || ""}>{s.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                        </>
                      ) : (
                        <>
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
                                  updateStatus.mutate({ id: s.id, status: v });
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 w-auto border-0 p-0">
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
                        </>
                      )}
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
