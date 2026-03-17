import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  fetchSubmissions,
  fetchSubmissionsByRecruiter,
  fetchSubmissionsByCandidate,
  fetchSubmissionsByTeamLead,
  fetchSubmissionsByAgency,
  createSubmission as createSubmissionFn,
} from "../../dbscripts/functions/submissions";
import { fetchCandidates, fetchCandidatesByRecruiter } from "../../dbscripts/functions/candidates";
import { uploadVendorJobDescription } from "../../dbscripts/functions/storage";
import { updateSubmission } from "../../dbscripts/functions/submissions";

const PAGE_SIZE = 10;

export default function VendorSubmissions() {
  const { user, profile, isCandidate, isRecruiter, isAdmin, isTeamLead, isAgencyAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
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

  const submissionsQueryFn = async () => {
    if (isCandidate) {
      if (!profile?.linked_candidate_id) return [];
      return fetchSubmissionsByCandidate(profile.linked_candidate_id);
    }
    if (isAgencyAdmin && profile?.agency_id) return fetchSubmissionsByAgency(profile.agency_id);
    if (isRecruiter) {
      if (!user?.id) return [];
      return fetchSubmissionsByRecruiter(user.id);
    }
    if (isTeamLead && profile?.id) return fetchSubmissionsByTeamLead(profile.id);
    return fetchSubmissions();
  };

  const enabled =
    isCandidate ? !!profile?.linked_candidate_id
    : isRecruiter ? !!user?.id
    : isAgencyAdmin ? !!profile?.agency_id
    : isTeamLead ? !!profile?.id
    : true;

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["submissions-vendor-responded", user?.id, profile?.linked_candidate_id, profile?.agency_id, profile?.id],
    queryFn: submissionsQueryFn,
    enabled,
  });

  const vendorSubmissions = submissions.filter((s: any) => s && s.status === "Vendor Responded");
  const totalPages = Math.max(1, Math.ceil(vendorSubmissions.length / PAGE_SIZE));
  const paginated = vendorSubmissions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Candidate dropdown for Add Vendor Submission (admin: all, recruiter: own)
  const candidatesQueryFn = async () => {
    if (isAdmin) return fetchCandidates();
    if (isRecruiter && user?.id) return fetchCandidatesByRecruiter(user.id);
    return [];
  };

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["vendor-submissions-candidates", user?.id],
    queryFn: candidatesQueryFn,
    enabled: isAdmin || (isRecruiter && !!user?.id),
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Submission</h1>
          <p className="text-sm text-muted-foreground">All submissions where status is Vendor Responded</p>
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
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No Vendor Responded submissions</TableCell>
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
                    <TableCell>{s.status}</TableCell>
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

          {!isLoading && vendorSubmissions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, vendorSubmissions.length)} of {vendorSubmissions.length}
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
    </div>
  );
}

