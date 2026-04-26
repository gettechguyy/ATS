import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fetchInvites, type FetchInvitesOpts } from "../../dbscripts/functions/invites";
import { getAppBaseUrl } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

type InviteSortKey = NonNullable<FetchInvitesOpts["sortBy"]>;

export default function InvitesPage() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  const [inviteSort, setInviteSort] = useState<{ key: InviteSortKey; order: "asc" | "desc" }>({
    key: "created_at",
    order: "desc",
  });

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["invites", profile?.company_id, inviteSort],
    queryFn: () =>
      fetchInvites(profile!.company_id!, {
        sortBy: inviteSort.key,
        order: inviteSort.order,
      }),
    enabled: !!profile?.company_id,
  });

  const toggleInviteSort = (key: InviteSortKey) => {
    setInviteSort((prev) =>
      prev.key === key ? { key, order: prev.order === "asc" ? "desc" : "asc" } : { key, order: key === "created_at" ? "desc" : "asc" }
    );
  };

  const inviteSortArrow = (key: InviteSortKey) =>
    inviteSort.key === key ? (
      inviteSort.order === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )
    ) : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Invites</h1>
        <p className="text-sm text-muted-foreground">Pending candidate invites</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Candidate Invites</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInviteSort("email")}>
                    Email {inviteSortArrow("email")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInviteSort("full_name")}>
                    Name {inviteSortArrow("full_name")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInviteSort("used")}>
                    Status {inviteSortArrow("used")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleInviteSort("created_at")}>
                    Created {inviteSortArrow("created_at")}
                  </button>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : invites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No invites
                  </TableCell>
                </TableRow>
              ) : (
                invites.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>{inv.full_name}</TableCell>
                    <TableCell>{inv.used ? "Used" : "Pending"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {!inv.used && (
                        <Button
                          size="sm"
                          onClick={() => {
                            const link = `${getAppBaseUrl()}/set-password?token=${inv.token}`;
                            navigator.clipboard.writeText(link);
                            setCopied(inv.id);
                            setTimeout(() => setCopied(null), 2000);
                          }}
                        >
                          {copied === inv.id ? "Copied" : "Copy Link"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
