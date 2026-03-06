import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { fetchAllOffersPaginated, fetchOffersByCandidatePaginated, fetchOffersByRecruiterPaginated, fetchOffersByAgencyPaginated, updateOfferStatus } from "../../dbscripts/functions/offers";

const PAGE_SIZE = 10;
const OFFER_STATUSES = ["Pending", "Accepted", "Declined"] as const;

export default function Offers() {
  const { user, profile, role, isCandidate, isRecruiter, isAgencyAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("offered_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const { data: result, isLoading } = useQuery({
    queryKey: ["all-offers", role, user?.id, profile?.linked_candidate_id, profile?.agency_id, page, PAGE_SIZE, sortBy, order],
    queryFn: async () => {
      if (isCandidate) {
        if (!profile?.linked_candidate_id) return { data: [], total: 0 };
        return fetchOffersByCandidatePaginated(profile.linked_candidate_id, { page, pageSize: PAGE_SIZE, sortBy, order });
      }
      if (isAgencyAdmin && profile?.agency_id) return fetchOffersByAgencyPaginated(profile.agency_id, { page, pageSize: PAGE_SIZE, sortBy, order });
      if (isRecruiter && user?.id) return fetchOffersByRecruiterPaginated(user.id, { page, pageSize: PAGE_SIZE, sortBy, order });
      return fetchAllOffersPaginated({ page, pageSize: PAGE_SIZE, sortBy, order });
    },
  });

  const list = result?.data ?? [];
  const totalCount = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  useEffect(() => setPage(1), [sortBy, order]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await updateOfferStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-offers"] });
      toast.success("Updated");
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{isCandidate ? "My Offers" : "Offers"}</h1>
        <p className="text-sm text-muted-foreground">{isCandidate ? "Your offers" : "Track all offers and acceptance status"}</p>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="offered_at">Offer date</SelectItem>
              <SelectItem value="salary">Salary</SelectItem>
              <SelectItem value="tentative_start_date">Start date</SelectItem>
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
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No offers found</TableCell>
                  </TableRow>
                ) : (
                  list.map((o: any) => {
                    const sub = o.submissions;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{sub?.candidates?.first_name} {sub?.candidates?.last_name || ""}</TableCell>
                        <TableCell>{sub?.client_name}</TableCell>
                        <TableCell>{sub?.position}</TableCell>
                        <TableCell className="font-medium">${Number(o.salary).toLocaleString()}</TableCell>
                        <TableCell>
                          <Select value={o.status} onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v })}>
                            <SelectTrigger className="h-7 w-auto border-0 p-0">
                              <Badge className={
                                o.status === "Accepted" ? "bg-success text-success-foreground" :
                                o.status === "Declined" ? "bg-destructive text-destructive-foreground" :
                                "bg-warning/10 text-warning"
                              }>{o.status}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {OFFER_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{o.tentative_start_date ? new Date(o.tentative_start_date).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="whitespace-pre-wrap max-w-xs truncate">{o.additional_notes || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(o.offered_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/submissions/${o.submission_id}`}><Eye className="h-4 w-4" /></Link>
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
