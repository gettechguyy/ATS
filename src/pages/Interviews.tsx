import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllInterviews, fetchInterviewsByCandidate, fetchInterviewsByRecruiter } from "../../dbscripts/functions/interviews";

export default function Interviews() {
  const { user, profile, role, isCandidate, isRecruiter } = useAuth();

  const interviewsQueryFn = async () => {
    if (isCandidate) {
      if (!profile?.linked_candidate_id) return [];
      return fetchInterviewsByCandidate(profile.linked_candidate_id);
    }
    if (isRecruiter && user?.id) return fetchInterviewsByRecruiter(user.id);
    return fetchAllInterviews();
  };

  const { data: interviews, isLoading } = useQuery({
    queryKey: ["all-interviews", role, user?.id, profile?.linked_candidate_id],
    queryFn: interviewsQueryFn,
  });

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
                {interviews?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No interviews found</TableCell>
                  </TableRow>
                ) : (
                  interviews?.map((iv: any) => {
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
      </Card>
    </div>
  );
}
