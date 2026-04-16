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
import { Eye, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchAllOffersPaginated, fetchOffersByCandidatePaginated, fetchOffersByRecruiterPaginated, fetchOffersByAgencyPaginated, updateOfferStatus } from "../../dbscripts/functions/offers";

const PAGE_SIZE = 10;
const OFFER_STATUSES = ["Pending", "Accepted", "Declined"] as const;

type OfferSortKey =
  | "submission_client_name"
  | "submission_position"
  | "salary"
  | "status"
  | "tentative_start_date"
  | "offered_at";

export default function Offers() {
  const { user, profile, role, isCandidate, isRecruiter, isAgencyAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<OfferSortKey>("offered_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const toggleOfferSort = (field: OfferSortKey) => {
    if (sortBy === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      if (field === "offered_at" || field === "salary" || field === "tentative_start_date") setOrder("desc");
      else setOrder("asc");
    }
  };

  const offerSortArrow = (field: OfferSortKey) =>
    sortBy === field ? (
      order === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )
    ) : null;

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
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleOfferSort("submission_client_name")}>
                      Client {offerSortArrow("submission_client_name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleOfferSort("submission_position")}>
                      Position {offerSortArrow("submission_position")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleOfferSort("salary")}>
                      Salary {offerSortArrow("salary")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleOfferSort("status")}>
                      Status {offerSortArrow("status")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleOfferSort("tentative_start_date")}>
                      Start Date {offerSortArrow("tentative_start_date")}
                    </button>
                  </TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleOfferSort("offered_at")}>
                      Date {offerSortArrow("offered_at")}
                    </button>
                  </TableHead>
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
