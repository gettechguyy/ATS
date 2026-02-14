import { useState } from "react";
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
import { Plus, Search, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCandidates, fetchCandidatesByRecruiter, createCandidate as createCandidateFn, deleteCandidate as deleteCandidateFn } from "../../dbscripts/functions/candidates";
import { fetchProfilesBySelect } from "../../dbscripts/functions/profiles";

const CANDIDATE_STATUSES = ["New", "In Marketing", "Placed", "Backout", "On Bench", "In Training"] as const;

const statusColors: Record<string, string> = {
  New: "bg-secondary text-secondary-foreground",
  "In Marketing": "bg-info/10 text-info",
  Placed: "bg-success text-success-foreground",
  Backout: "bg-destructive/10 text-destructive",
  "On Bench": "bg-warning/10 text-warning",
  "In Training": "bg-accent text-accent-foreground",
};

export default function Candidates() {
  const { user, isAdmin, isRecruiter, isManager, isCandidate } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isCandidate) return <Navigate to="/" replace />;

  const { data: recruiters } = useQuery({
    queryKey: ["recruiters"],
    queryFn: () => fetchProfilesBySelect("user_id, full_name, email"),
    enabled: !isCandidate,
  });

  const canSeeAllCandidates = isAdmin || isManager;
  const { data: candidates, isLoading } = useQuery({
    queryKey: ["candidates", canSeeAllCandidates ? "all" : user?.id],
    queryFn: () => (canSeeAllCandidates ? fetchCandidates() : fetchCandidatesByRecruiter(user!.id)),
    enabled: !!user && !isCandidate,
  });

  const createCandidate = useMutation({
    mutationFn: async (fd: FormData) => {
      await createCandidateFn({
        first_name: fd.get("first_name") as string,
        last_name: (fd.get("last_name") as string) || null,
        email: (fd.get("email") as string) || null,
        phone: (fd.get("phone") as string) || null,
        recruiter_id: (fd.get("recruiter") as string) || user!.id,
        status: "New",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      setDialogOpen(false);
      toast.success("Candidate created");
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

  const filtered = candidates?.filter((c: any) => {
    const name = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getRecruiterName = (id: string) =>
    recruiters?.find((r: any) => r.user_id === id)?.full_name || "Unassigned";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
          <p className="text-sm text-muted-foreground">Manage candidate pipeline</p>
        </div>
        {(isAdmin || isRecruiter) && (
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
                  <TableHead>Status</TableHead>
                  <TableHead>Recruiter</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No candidates found</TableCell>
                  </TableRow>
                ) : (
                  filtered?.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.first_name} {c.last_name || ""}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                      <TableCell><Badge className={statusColors[c.status] || ""}>{c.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{getRecruiterName(c.recruiter_id)}</TableCell>
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
      </Card>
    </div>
  );
}
