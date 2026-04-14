import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { fetchSpecialSubmissionsPage, type SpecialSubmissionsRoleContext } from "../../dbscripts/functions/submissions";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 10;

export default function AssessmentsPage() {
  const { user, profile, isCandidate, isRecruiter, isAdmin, isManager, isTeamLead, isAgencyAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const assessmentsPageContext = useMemo((): SpecialSubmissionsRoleContext | null => {
    if (isCandidate && profile?.linked_candidate_id) {
      return { role: "candidate", linkedCandidateId: profile.linked_candidate_id };
    }
    if (isAgencyAdmin && profile?.agency_id) return { role: "agency", agencyId: profile.agency_id };
    if (isRecruiter && user?.id) return { role: "recruiter", recruiterId: user.id };
    if (isTeamLead && profile?.id) return { role: "team_lead", teamLeadProfileId: profile.id };
    if (isAdmin || isManager) return { role: "admin" };
    return null;
  }, [
    isCandidate,
    profile?.linked_candidate_id,
    profile?.agency_id,
    profile?.id,
    isAgencyAdmin,
    isRecruiter,
    user?.id,
    isTeamLead,
    isAdmin,
    isManager,
  ]);

  const assessmentsEnabled =
    assessmentsPageContext != null &&
    (isCandidate ? !!profile?.linked_candidate_id
    : isRecruiter ? !!user?.id
    : isAgencyAdmin ? !!profile?.agency_id
    : isTeamLead ? !!profile?.id
    : true);

  const { data: assessmentsPage, isLoading } = useQuery({
    queryKey: ["submissions-assessments", assessmentsPageContext, page, search],
    queryFn: () =>
      fetchSpecialSubmissionsPage("assessment", assessmentsPageContext!, {
        page,
        pageSize: PAGE_SIZE,
        search,
        sortBy: "created_at",
        order: "desc",
      }),
    enabled: assessmentsEnabled,
  });

  const rows = assessmentsPage?.data ?? [];
  const totalCount = assessmentsPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => setPage(1), [search]);

  const colSpan = !isCandidate ? 7 : 6;

  return (
    <div>
      <div className="mb-6 space-y-3">
        <div>
          <h1 className="text-2xl font-bold">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Submissions in Assessment status. After vendor response, screening can go to assessment or screen calls directly—this list is only the assessment branch.
          </p>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by client, position, or candidate name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {!isCandidate && <TableHead>Candidate</TableHead>}
                <TableHead>Client</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Assessment end</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Attachment</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={colSpan} className="py-6 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={colSpan} className="py-6 text-center text-muted-foreground">No assessments</TableCell></TableRow>
              ) : (
                rows.map((s: any) => (
                  <TableRow key={s.id}>
                    {!isCandidate && (
                      <TableCell className="font-medium">
                        {s.candidates?.first_name} {s.candidates?.last_name || ""}
                      </TableCell>
                    )}
                    <TableCell>{s.client_name}</TableCell>
                    <TableCell>{s.position}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.assessment_end_date
                        ? new Date(s.assessment_end_date + "T12:00:00").toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {s.assessment_link ? (
                        <a href={s.assessment_link} target="_blank" rel="noreferrer" className="text-xs text-info underline">
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {s.assessment_attachment_url ? (
                        <a href={s.assessment_attachment_url} target="_blank" rel="noreferrer" className="text-xs text-info underline">
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/submissions/${s.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Select value={String(page)} onValueChange={(v) => setPage(Number(v))}>
                <SelectTrigger className="h-8 w-[7rem]">
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
