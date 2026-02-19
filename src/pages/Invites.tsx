import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fetchInvites } from "../../dbscripts/functions/invites";
import { useState } from "react";

export default function InvitesPage() {
  const { data: invites, isLoading } = useQuery({ queryKey: ["invites"], queryFn: fetchInvites });
  const [copied, setCopied] = useState<string | null>(null);

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
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? null : invites?.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{inv.full_name}</TableCell>
                  <TableCell>{inv.used ? "Used" : "Pending"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {!inv.used && (
                      <Button size="sm" onClick={() => {
                        const link = `${window.location.origin}/set-password?token=${inv.token}`;
                        navigator.clipboard.writeText(link);
                        setCopied(inv.id);
                        setTimeout(() => setCopied(null), 2000);
                      }}>
                        {copied === inv.id ? "Copied" : "Copy Link"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

