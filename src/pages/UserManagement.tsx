import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, Shield, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { fetchAllProfiles, updateProfile } from "../../dbscripts/functions/profiles";
import { fetchAllUserRoles, updateUserRole, insertUserRole } from "../../dbscripts/functions/userRoles";
import { fetchCandidatesBasic } from "../../dbscripts/functions/candidates";

const ROLES = ["admin", "recruiter", "candidate", "manager"] as const;

export default function UserManagement() {
  const { isAdmin, createUser } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("recruiter");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        fetchAllProfiles(),
        fetchAllUserRoles(),
      ]);
      return profiles.map((p: any) => ({
        ...p,
        role: roles.find((r: any) => r.user_id === p.user_id)?.role || "recruiter",
        roleId: roles.find((r: any) => r.user_id === p.user_id)?.id,
      }));
    },
    enabled: isAdmin,
  });

  const { data: candidates } = useQuery({
    queryKey: ["all-candidates-for-linking"],
    queryFn: fetchCandidatesBasic,
    enabled: isAdmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId, newRole }: { userId: string; roleId?: string; newRole: string }) => {
      if (roleId) {
        await updateUserRole(roleId, newRole);
      } else {
        await insertUserRole(userId, newRole);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkCandidate = useMutation({
    mutationFn: async ({ userId, candidateId }: { userId: string; candidateId: string | null }) => {
      await updateProfile(userId, { linked_candidate_id: candidateId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Candidate linked");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      await updateProfile(userId, { is_active: isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createUserMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const { error } = await createUser(
        fd.get("email") as string,
        fd.get("password") as string,
        fd.get("full_name") as string,
        fd.get("role") as string || selectedRole,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateDialogOpen(false);
      toast.success("User created. They can sign in with their email and password.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground">Manage team members, roles, and candidate assignments</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input name="full_name" required />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input name="password" type="password" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <input type="hidden" name="role" value={selectedRole} />
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}><Badge variant={r === "admin" ? "default" : "secondary"} className="capitalize">{r}</Badge></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Team Members ({users?.length || 0})
          </CardTitle>
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Linked Candidate</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No users found</TableCell>
                  </TableRow>
                ) : (
                  users?.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(v) => updateRoleMutation.mutate({ userId: u.user_id, roleId: u.roleId, newRole: v })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                <Badge variant={r === "admin" ? "default" : "secondary"} className="capitalize">{r}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.role === "candidate" ? (
                          <Select
                            value={u.linked_candidate_id || "none"}
                            onValueChange={(v) => linkCandidate.mutate({ userId: u.user_id, candidateId: v === "none" ? null : v })}
                          >
                            <SelectTrigger className="h-8 w-48">
                              <SelectValue placeholder="Select candidate..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {candidates?.map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name || ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.is_active !== false}
                          onCheckedChange={(checked) => toggleActive.mutate({ userId: u.user_id, isActive: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
