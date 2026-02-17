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
import { ArrowLeft, Plus, FileText, Calendar, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import ResumeUpload from "@/components/ResumeUpload";
import DocumentUpload from "@/components/DocumentUpload";
import { fetchCandidateById, updateCandidateStatus, updateCandidate as updateCandidateFn } from "../../dbscripts/functions/candidates";
import { fetchSubmissionsByCandidate, createSubmission as createSubmissionFn } from "../../dbscripts/functions/submissions";
import { fetchProfileName } from "../../dbscripts/functions/profiles";
import { fetchProfilesBySelect } from "../../dbscripts/functions/profiles";

const CANDIDATE_STATUSES = ["New", "In Marketing", "Placed", "Backout", "On Bench", "In Training"] as const;
const VISA_STATUSES = ["OPT", "H1B", "GC", "Citizen", "Other"] as const;

const MASK = "*******";

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isAdmin, isRecruiter, isCandidate } = useAuth();
  const queryClient = useQueryClient();
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editVisa, setEditVisa] = useState("Other");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZip, setEditZip] = useState("");

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
  }, [candidate?.visa_status]);

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

  const { data: recruiters } = useQuery({
    queryKey: ["recruiters"],
    queryFn: () => fetchProfilesBySelect("user_id, full_name, email"),
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

  const canSeePersonalDetails = isAdmin || isRecruiter || isOwnProfile;
  const displayEmail = canSeePersonalDetails ? (candidate.email || "—") : (candidate.email ? MASK : "—");
  const displayPhone = canSeePersonalDetails ? (candidate.phone || "—") : (candidate.phone ? MASK : "—");
  const showVisaStatus = isAdmin || isRecruiter || isOwnProfile;

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
                    onSubmit={(e) => {
                      e.preventDefault();
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
                        { onSuccess: () => setEditDialogOpen(false) }
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
                      <Input name="email" type="email" defaultValue={candidate.email || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input name="phone" defaultValue={candidate.phone || ""} />
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
                    <Button type="submit" className="w-full" disabled={updateCandidate.isPending}>Save</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Email:</span> {displayEmail}</div>
            <div><span className="text-muted-foreground">Phone:</span> {displayPhone}</div>
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
              <div><span className="text-muted-foreground">Visa status:</span> {candidate.visa_status || "—"}</div>
            )}
            <div>
              <span className="text-muted-foreground">Resume:</span>
              {(isAdmin || isRecruiter || isOwnProfile) && (
                <ResumeUpload
                  candidateId={candidate.id}
                  currentUrl={candidate.resume_url}
                  onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                />
              )}
            </div>
            <div className="pt-2">
              <Label className="text-muted-foreground">ID Proof</Label>
              <DocumentUpload
                candidateId={candidate.id}
                currentUrl={(candidate as any).id_copy_url || null}
                folder="id"
                onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
              />
            </div>
            {candidate.visa_status !== "GC" && candidate.visa_status !== "Citizen" && (
              <div className="pt-2">
                <Label className="text-muted-foreground">Visa Copy</Label>
                <DocumentUpload
                  candidateId={candidate.id}
                  currentUrl={(candidate as any).visa_copy_url || null}
                  folder="visa"
                  onUploaded={() => queryClient.invalidateQueries({ queryKey: ["candidate", id] })}
                />
              </div>
            )}
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
