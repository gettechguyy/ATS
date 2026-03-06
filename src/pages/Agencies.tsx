import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAgencies, createAgency } from "../../dbscripts/functions/agencies";

export default function Agencies() {
  const { isAdmin, user, createUser } = useAuth();
  const queryClient = useQueryClient();
  const [addAgencyOpen, setAddAgencyOpen] = useState(false);
  const [newAgencyName, setNewAgencyName] = useState("");
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<{ id: string; name: string } | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFullName, setAdminFullName] = useState("");

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ["agencies"],
    queryFn: fetchAgencies,
    enabled: isAdmin,
  });

  const createAgencyMutation = useMutation({
    mutationFn: (name: string) => createAgency({ name, type: "out" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      setAddAgencyOpen(false);
      setNewAgencyName("");
      toast.success("Agency created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createAgencyAdminMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgency?.id || !adminEmail.trim() || !adminPassword || !adminFullName.trim()) {
        throw new Error("Agency, email, password, and full name required");
      }
      const { error } = await createUser(
        adminEmail.trim(),
        adminPassword,
        adminFullName.trim(),
        "agency_admin",
        selectedAgency.id
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      setCreateAdminOpen(false);
      setSelectedAgency(null);
      setAdminEmail("");
      setAdminPassword("");
      setAdminFullName("");
      toast.success("Agency admin user created. They can sign in with their email and password.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreateAgency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgencyName.trim()) {
      toast.error("Agency name required");
      return;
    }
    createAgencyMutation.mutate(newAgencyName.trim());
  };

  const handleCreateAgencyAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    createAgencyAdminMutation.mutate();
  };

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Agencies
          </h1>
          <p className="text-sm text-muted-foreground">Manage out agencies. Add an agency and create its admin user.</p>
        </div>
        <Dialog open={addAgencyOpen} onOpenChange={setAddAgencyOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Agency</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Out Agency</DialogTitle></DialogHeader>
            <form onSubmit={handleCreateAgency} className="space-y-4">
              <div className="space-y-2">
                <Label>Agency Name *</Label>
                <Input
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                  placeholder="Agency name"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Type is set to Out. After creating, use &quot;Create admin&quot; to add the agency admin user.</p>
              <Button type="submit" className="w-full" disabled={createAgencyMutation.isPending}>
                {createAgencyMutation.isPending ? "Creating..." : "Create Agency"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Out Agencies ({agencies.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No agencies yet. Add an agency to get started.</TableCell>
                  </TableRow>
                ) : (
                  agencies.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{a.type || "out"}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAgency({ id: a.id, name: a.name });
                            setCreateAdminOpen(true);
                          }}
                        >
                          <UserPlus className="mr-1 h-4 w-4" /> Create admin
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

      <Dialog open={createAdminOpen} onOpenChange={(open) => { setCreateAdminOpen(open); if (!open) setSelectedAgency(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create agency admin for {selectedAgency?.name ?? "agency"}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateAgencyAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                placeholder="Admin full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@agency.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={createAgencyAdminMutation.isPending}>
              {createAgencyAdminMutation.isPending ? "Creating..." : "Create agency admin"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
