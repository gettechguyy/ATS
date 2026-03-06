import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllInterviewsPaginated, fetchInterviewsByCandidatePaginated, fetchInterviewsByRecruiterPaginated, fetchInterviewsByAgencyPaginated } from "../../dbscripts/functions/interviews";

const PAGE_SIZE = 10;

export default function Interviews() {
  const { user, profile, role, isCandidate, isRecruiter, isAgencyAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("scheduled_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data: result, isLoading } = useQuery({
    queryKey: ["all-interviews", role, user?.id, profile?.linked_candidate_id, profile?.agency_id, page, PAGE_SIZE, sortBy, order],
    queryFn: async () => {
      if (isCandidate) {
        if (!profile?.linked_candidate_id) return { data: [], total: 0 };
        return fetchInterviewsByCandidatePaginated(profile.linked_candidate_id, { page, pageSize: PAGE_SIZE, sortBy, order });
      }
      if (isAgencyAdmin && profile?.agency_id) return fetchInterviewsByAgencyPaginated(profile.agency_id, { page, pageSize: PAGE_SIZE, sortBy, order });
      if (isRecruiter && user?.id) return fetchInterviewsByRecruiterPaginated(user.id, { page, pageSize: PAGE_SIZE, sortBy, order });
      return fetchAllInterviewsPaginated({ page, pageSize: PAGE_SIZE, sortBy, order });
    },
  });

  const list = result?.data ?? [];
  const totalCount = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  useEffect(() => setPage(1), [sortBy, order]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{isCandidate ? "My Interviews" : "Interviews"}</h1>
        <p className="text-sm text-muted-foreground">{isCandidate ? "Your scheduled interviews" : "All scheduled interviews"}</p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled_at">Scheduled date</SelectItem>
              <SelectItem value="round_number">Round</SelectItem>
              <SelectItem value="created_at">Date added</SelectItem>
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
                  <TableHead>Candidate</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No interviews found</TableCell>
                  </TableRow>
                ) : (
                  list.map((iv: any) => {
                    const sub = iv.submissions;
                    return (
                      <TableRow key={iv.id}>
                        <TableCell className="font-medium">{sub?.candidates?.first_name} {sub?.candidates?.last_name || ""}</TableCell>
                        <TableCell>{sub?.client_name}</TableCell>
                        <TableCell>{sub?.position}</TableCell>
                        <TableCell><Badge variant="outline">Round {iv.round_number}</Badge></TableCell>
                        <TableCell>{iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{iv.mode}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{iv.status}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/submissions/${iv.submission_id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
