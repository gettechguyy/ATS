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
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchAllOffers, fetchOffersByCandidate, fetchOffersByRecruiter, updateOfferStatus } from "../../dbscripts/functions/offers";

const OFFER_STATUSES = ["Pending", "Accepted", "Declined"] as const;

export default function Offers() {
  const { user, profile, role, isCandidate, isRecruiter } = useAuth();
  const queryClient = useQueryClient();

  const offersQueryFn = async () => {
    if (isCandidate) {
      if (!profile?.linked_candidate_id) return [];
      return fetchOffersByCandidate(profile.linked_candidate_id);
    }
    if (isRecruiter && user?.id) return fetchOffersByRecruiter(user.id);
    return fetchAllOffers();
  };

  const { data: offers, isLoading } = useQuery({
    queryKey: ["all-offers", role, user?.id, profile?.linked_candidate_id],
    queryFn: offersQueryFn,
  });

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
                {offers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No offers found</TableCell>
                  </TableRow>
                ) : (
                  offers?.map((o: any) => {
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
      </Card>
    </div>
  );
}
