import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, Building2, Plus, UserPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAgencies, createAgency, updateAgency } from "../../dbscripts/functions/agencies";

export default function Agencies() {
  const { isAdmin, user, createUser, profile, isMasterCompany } = useAuth();
  const queryClient = useQueryClient();
  const [addAgencyOpen, setAddAgencyOpen] = useState(false);
  const [newAgencyName, setNewAgencyName] = useState("");
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<{ id: string; name: string } | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [editAgencyOpen, setEditAgencyOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<{ id: string; name: string } | null>(null);
  const [editAgencyName, setEditAgencyName] = useState("");
  type AgencySortKey = "name" | "type" | "is_active";
  const [agencySort, setAgencySort] = useState<{ key: AgencySortKey; order: "asc" | "desc" }>({
    key: "name",
    order: "asc",
  });

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ["agencies", profile?.company_id, agencySort],
    queryFn: () =>
      fetchAgencies(profile!.company_id!, {
        sortBy: agencySort.key,
        order: agencySort.order,
      }),
    enabled: isAdmin && !!profile?.company_id,
  });

  const createAgencyMutation = useMutation({
    mutationFn: (name: string) => createAgency({ name, type: "out", company_id: profile!.company_id! }),
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

  const updateAgencyMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await updateAgency(id, { name: name.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      setEditAgencyOpen(false);
      setEditingAgency(null);
      setEditAgencyName("");
      toast.success("Agency name updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleAgencyActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await updateAgency(id, { is_active: isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agency status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleAgencySort = (key: AgencySortKey) => {
    setAgencySort((prev) =>
      prev.key === key ? { key, order: prev.order === "asc" ? "desc" : "asc" } : { key, order: key === "is_active" ? "desc" : "asc" }
    );
  };

  const agencySortArrow = (key: AgencySortKey) =>
    agencySort.key === key ? (
      agencySort.order === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )
    ) : null;

  const handleEditAgency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgency?.id || !editAgencyName.trim()) return;
    updateAgencyMutation.mutate({ id: editingAgency.id, name: editAgencyName.trim() });
  };

  if (!isAdmin || !isMasterCompany) return <Navigate to="/" replace />;

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
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleAgencySort("name")}>
                      Name {agencySortArrow("name")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleAgencySort("type")}>
                      Type {agencySortArrow("type")}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="flex items-center gap-1 font-medium hover:opacity-80" onClick={() => toggleAgencySort("is_active")}>
                      Status {agencySortArrow("is_active")}
                    </button>
                  </TableHead>
                  <TableHead className="w-64">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No agencies yet. Add an agency to get started.</TableCell>
                  </TableRow>
                ) : (
                  agencies.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{a.type || "out"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={a.is_active !== false}
                            onCheckedChange={(val) =>
                              toggleAgencyActiveMutation.mutate({ id: a.id, isActive: val })
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {a.is_active === false ? "Inactive" : "Active"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingAgency({ id: a.id, name: a.name });
                              setEditAgencyName(a.name);
                              setEditAgencyOpen(true);
                            }}
                          >
                            <Pencil className="mr-1 h-4 w-4" /> Edit
                          </Button>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editAgencyOpen} onOpenChange={(open) => { setEditAgencyOpen(open); if (!open) { setEditingAgency(null); setEditAgencyName(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit agency</DialogTitle></DialogHeader>
          <form onSubmit={handleEditAgency} className="space-y-4">
            <div className="space-y-2">
              <Label>Agency Name *</Label>
              <Input
                value={editAgencyName}
                onChange={(e) => setEditAgencyName(e.target.value)}
                placeholder="Agency name"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateAgencyMutation.isPending}>
              {updateAgencyMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
