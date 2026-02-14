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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchSubmissions, fetchSubmissionsByRecruiter, fetchSubmissionsByCandidate, updateSubmissionStatus } from "../../dbscripts/functions/submissions";

const SUBMISSION_STATUSES = ["Applied", "Screen Call", "Interview", "Rejected", "Offered"] as const;

const statusColors: Record<string, string> = {
  Applied: "bg-secondary text-secondary-foreground",
  "Screen Call": "bg-info/10 text-info",
  Interview: "bg-warning/10 text-warning",
  Rejected: "bg-destructive/10 text-destructive",
  Offered: "bg-success/10 text-success",
};

export default function Submissions() {
  const { user, profile, role, isCandidate, isRecruiter } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const submissionsQueryFn = async () => {
    if (isCandidate) {
      if (!profile?.linked_candidate_id) return [];
      return fetchSubmissionsByCandidate(profile.linked_candidate_id);
    }
    if (isRecruiter && user?.id) return fetchSubmissionsByRecruiter(user.id);
    return fetchSubmissions();
  };

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["submissions", role, user?.id, profile?.linked_candidate_id],
    queryFn: submissionsQueryFn,
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
        <h1 className="text-2xl font-bold text-foreground">{isCandidate ? "My Submissions" : "Submissions"}</h1>
        <p className="text-sm text-muted-foreground">{isCandidate ? "Your job submissions" : "Track all job submissions"}</p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search submissions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
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
                  <TableHead>Candidate</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No submissions found</TableCell>
                  </TableRow>
                ) : (
                  filtered?.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.candidates?.first_name} {s.candidates?.last_name || ""}</TableCell>
                      <TableCell>{s.client_name}</TableCell>
                      <TableCell>{s.position}</TableCell>
                      <TableCell>
                        <Select
                          value={s.status}
                          onValueChange={(v) => updateStatus.mutate({ id: s.id, status: v })}
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
