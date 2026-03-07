import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Eye, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Link, Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCandidatesPaginated, fetchCandidatesByRecruiterPaginated, createCandidate as createCandidateFn, deleteCandidate as deleteCandidateFn, updateCandidate } from "../../dbscripts/functions/candidates";
import { fetchProfilesBySelect, fetchProfilesByRole, updateProfile } from "../../dbscripts/functions/profiles";
import { fetchAgencies } from "../../dbscripts/functions/agencies";
import { createAppUser } from "@/lib/authApi";
import { createInvite } from "../../dbscripts/functions/invites";
import { getAppBaseUrl } from "@/lib/utils";

const CANDIDATE_STATUSES = ["New", "In Marketing", "Placed", "Backout", "On Bench", "In Training"] as const;

const PAGE_SIZE = 10;
const statusColors: Record<string, string> = {
  New: "bg-secondary text-secondary-foreground",
  "In Marketing": "bg-info/10 text-info",
  Placed: "bg-success text-success-foreground",
  Backout: "bg-destructive/10 text-destructive",
  "On Bench": "bg-warning/10 text-warning",
  "In Training": "bg-accent text-accent-foreground",
};

export default function Candidates() {
  const { user, profile, isAdmin, isRecruiter, isManager, isCandidate, isAgencyAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  if (isCandidate) return <Navigate to="/" replace />;

  const canSeeAllCandidates = isAdmin || isManager;
  const { data: recruiters } = useQuery({
    queryKey: ["recruiters", isAgencyAdmin ? profile?.agency_id : "master"],
    queryFn: () => fetchProfilesByRole("recruiter", isAgencyAdmin ? profile?.agency_id ?? undefined : undefined),
    enabled: !isCandidate,
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: fetchAgencies,
    enabled: !isAgencyAdmin,
  });

  const { data: candidatesResult, isLoading } = useQuery({
    queryKey: ["candidates", canSeeAllCandidates ? "all" : isAgencyAdmin ? profile?.agency_id : user?.id, page, PAGE_SIZE, search, statusFilter, sortBy, order],
    queryFn: () => {
      const opts = { page, pageSize: PAGE_SIZE, search, status: statusFilter, sortBy, order };
      if (isAgencyAdmin) {
        if (profile?.agency_id) return fetchCandidatesPaginated({ ...opts, agencyId: profile.agency_id });
        return Promise.resolve({ data: [], total: 0 });
      }
      if (canSeeAllCandidates) {
        return fetchCandidatesPaginated(opts);
      }
      return fetchCandidatesByRecruiterPaginated(user!.id, opts);
    },
    enabled: !!user && !isCandidate,
  });
  const candidates = candidatesResult?.data ?? [];
  const totalCount = candidatesResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const createCandidate = useMutation({
    mutationFn: async (fd: FormData) => {
      const first_name = fd.get("first_name") as string;
      const last_name = (fd.get("last_name") as string) || null;
      const email = (fd.get("email") as string) || null;
      const phone = (fd.get("phone") as string) || null;
      const recruiter_id = (fd.get("recruiter") as string) || user!.id;

      // Create candidate row and get its id
      const created = await createCandidateFn({
        first_name,
        last_name,
        email,
        phone,
        recruiter_id,
        status: "New",
      });

      // If email provided, provision an app user/profile immediately and create an invite so they can set their password later.
      if (email) {
        try {
          // 1) Create app user/profile/role with a temporary random password so the user exists immediately.
          // createAppUser RPC expects the current admin user's id as first arg.
          const tempPassword = crypto.randomUUID();
          await createAppUser(user!.id, email, tempPassword, `${first_name} ${last_name || ""}`, "candidate");

          // 2) Link the created profile to the candidate record.
          // The createAppUser RPC inserts a profile with user_id = new app_user id.
          // We need to find that profile by email and set linked_candidate_id.
          const profiles = await fetchProfilesBySelect("user_id, email");
          const match = (profiles || []).find((p: any) => (p.email || "").toLowerCase() === (email || "").toLowerCase());
          if (match && match.user_id) {
            await updateProfile(match.user_id, { linked_candidate_id: created?.id });
          }

          // 3) Create an invite tied to this candidate so the user can set a new password via the invite flow.
          const token = crypto.randomUUID();
          await createInvite({ token, email, full_name: `${first_name} ${last_name || ""}`, role: "candidate", created_by: user?.id || "", candidate_id: created?.id });
          const inviteLink = `${getAppBaseUrl()}/set-password?token=${token}`;
          const webhook = import.meta.env.VITE_INVITE_WEBHOOK as string | undefined;
          if (webhook) {
            await fetch(webhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: `${first_name} ${last_name || ""}`, email, link: inviteLink }),
            });
          }
        } catch (err: any) {
          // Non-fatal: candidate was created, but provisioning user/profile/invite failed.
          console.error("Provision candidate user/profile failed:", err);
          throw err;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setDialogOpen(false);
      toast.success("Candidate created (invite sent if email provided)");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteCandidate = useMutation({
    mutationFn: deleteCandidateFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Candidate deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateAgencyMutation = useMutation({
    mutationFn: async ({ candidateId, agencyId }: { candidateId: string; agencyId: string | null }) => {
      try {
        await updateCandidate(candidateId, { agency_id: agencyId });
      } catch (err: any) {
        const message = err?.message ?? (err ? String(err) : "Failed to update agency");
        throw new Error(message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Agency updated");
    },
    onError: (err: Error) => toast.error(err?.message ?? "Failed to update agency"),
  });

  useEffect(() => setPage(1), [search, statusFilter, sortBy, order]);

  const getRecruiterName = (id: string) =>
    recruiters?.find((r: any) => r.user_id === id)?.full_name || "Unassigned";

  // Main company sees "Recruiter Name (Agency Name)" for agency recruiters; agency viewer sees name only (same as User Management).
  const displayRecruiterName = (recruiterId: string) => {
    const r = recruiters?.find((x: any) => x.user_id === recruiterId);
    const name = r?.full_name || "Unassigned";
    if (isAgencyAdmin || !r?.agency_id || !agencies?.length) return name;
    const agency = (agencies as any[]).find((a: any) => a.id === r.agency_id);
    return agency ? `${name} (${agency.name})` : name;
  };

  // Recruiters and agency admin/employees must not see personal email/phone — show as "—".
  const cannotSeePersonalContact = isRecruiter || isAgencyAdmin;
  const displayEmail = (c: any) => (cannotSeePersonalContact ? "—" : (c.email || "—"));
  const displayPhone = (c: any) => (cannotSeePersonalContact ? "—" : (c.phone || "—"));
  // Main company (admin/manager/recruiter) sees "Name (Agency Name)" for agency-assigned candidates; agency viewer sees name only.
  const displayCandidateName = (c: any) => {
    const name = `${c.first_name || ""} ${(c.last_name || "").trim()}`.trim() || "—";
    if (isAgencyAdmin || !c?.agency_id || !agencies?.length) return name;
    const agency = (agencies as any[]).find((a: any) => a.id === c.agency_id);
    return agency ? `${name} (${agency.name})` : name;
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
          <p className="text-sm text-muted-foreground">Manage candidate pipeline</p>
        </div>
        {(isAdmin && !isAgencyAdmin) && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Candidate</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Candidate</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createCandidate.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input name="first_name" required />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input name="last_name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="phone" />
              </div>
              {isAdmin && recruiters && (
                <div className="space-y-2">
                  <Label>Assign Recruiter</Label>
                  <Select name="recruiter" defaultValue={user!.id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {recruiters.map((r: any) => (
                        <SelectItem key={r.user_id} value={r.user_id}>{r.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={createCandidate.isPending}>
                {createCandidate.isPending ? "Creating..." : "Create Candidate"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search candidates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {CANDIDATE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first_name">First name</SelectItem>
              <SelectItem value="last_name">Last name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="created_at">Date added</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Select value={order} onValueChange={(v) => setOrder(v as "asc" | "desc")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Visa Status</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && !isAgencyAdmin && <TableHead>Assigned to agency</TableHead>}
                  <TableHead>Recruiter</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin && !isAgencyAdmin ? 8 : 7} className="py-8 text-center text-muted-foreground">No candidates found</TableCell>
                  </TableRow>
                ) : (
                  candidates.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{displayCandidateName(c)}</TableCell>
                      <TableCell className="text-muted-foreground">{displayEmail(c)}</TableCell>
                      <TableCell className="text-muted-foreground">{displayPhone(c)}</TableCell>
                      <TableCell className="text-muted-foreground">{c.visa_status || "—"}</TableCell>
                      <TableCell><Badge className={statusColors[c.status] || ""}>{c.status}</Badge></TableCell>
                      {isAdmin && !isAgencyAdmin && (
                        <TableCell>
                          <Select
                            value={agencies?.some((a: any) => a.id === c.agency_id) ? (c.agency_id ?? "none") : "none"}
                            onValueChange={(v) => updateAgencyMutation.mutate({ candidateId: c.id, agencyId: v === "none" ? null : v })}
                          >
                            <SelectTrigger className="w-44 h-8">
                              <SelectValue placeholder="Assign agency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {(agencies || []).map((a: any) => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground">{displayRecruiterName(c.recruiter_id)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/candidates/${c.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete candidate?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete this candidate and all related data.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteCandidate.mutate(c.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
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
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
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
    </div>
  );
}
