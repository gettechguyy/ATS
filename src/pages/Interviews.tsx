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
import { Eye, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllInterviewsPaginated, fetchInterviewsByCandidatePaginated, fetchInterviewsByRecruiterPaginated, fetchInterviewsByAgencyPaginated } from "../../dbscripts/functions/interviews";
import { formatInAppDateTime } from "@/lib/appTimezone";

const PAGE_SIZE = 10;

type InterviewSortKey =
  | "submission_client_name"
  | "submission_position"
  | "scheduled_at"
  | "round_number"
  | "mode"
  | "status";

export default function Interviews() {
  const { user, profile, role, isCandidate, isRecruiter, isAgencyAdmin, isMasterCompany } = useAuth();
  const isAgencyScope = isAgencyAdmin && isMasterCompany;
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<InterviewSortKey>("scheduled_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const toggleInterviewSort = (field: InterviewSortKey) => {
    if (sortBy === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      if (field === "scheduled_at" || field === "round_number") setOrder("desc");
      else setOrder("asc");
    }
  };

  const interviewSortArrow = (field: InterviewSortKey) =>
    sortBy === field ? (
      order === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )
    ) : null;

  const { data: result, isLoading } = useQuery({
    queryKey: ["all-interviews", role, user?.id, profile?.linked_candidate_id, profile?.agency_id, profile?.company_id, page, PAGE_SIZE, sortBy, order],
    queryFn: async () => {
      const companyId = profile?.company_id;
      if (isCandidate) {
        if (!profile?.linked_candidate_id) return { data: [], total: 0 };
        return fetchInterviewsByCandidatePaginated(profile.linked_candidate_id, { page, pageSize: PAGE_SIZE, sortBy, order });
      }
      if (!companyId) return { data: [], total: 0 };
      if (isAgencyScope && profile?.agency_id) {
        return fetchInterviewsByAgencyPaginated(profile.agency_id, companyId, { page, pageSize: PAGE_SIZE, sortBy, order });
      }
      if (isRecruiter && user?.id) {
        return fetchInterviewsByRecruiterPaginated(user.id, companyId, { page, pageSize: PAGE_SIZE, sortBy, order });
      }
      return fetchAllInterviewsPaginated(companyId, { page, pageSize: PAGE_SIZE, sortBy, order });
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
                  <TableHead>
                    <button
                      type="button"
                      className="flex items-center gap-1 font-medium hover:opacity-80"
                      onClick={() => toggleInterviewSort("submission_client_name")}
                    >
                      Client {interviewSortArrow("submission_client_name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInterviewSort("submission_position")}>
                      Position {interviewSortArrow("submission_position")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInterviewSort("round_number")}>
                      Round {interviewSortArrow("round_number")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInterviewSort("scheduled_at")}>
                      Date/Time {interviewSortArrow("scheduled_at")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInterviewSort("mode")}>
                      Mode {interviewSortArrow("mode")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInterviewSort("status")}>
                      Status {interviewSortArrow("status")}
                    </button>
                  </TableHead>
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
                        <TableCell>{formatInAppDateTime(iv.scheduled_at)}</TableCell>
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
