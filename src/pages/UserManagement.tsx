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
import { fetchCandidatesBasic, updateCandidate } from "../../dbscripts/functions/candidates";
import { updateAppUserPassword } from "@/lib/authApi";

const ROLES = ["admin", "recruiter", "candidate", "manager", "team_lead"] as const;

export default function UserManagement() {
  const { isAdmin, createUser, user, isManager, isTeamLead, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"team" | "candidates">("team");
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
    enabled: isAdmin || isManager || isTeamLead,
  });

  const { data: candidates } = useQuery({
    queryKey: ["all-candidates-for-linking"],
    queryFn: fetchCandidatesBasic,
    enabled: isAdmin || isManager || isTeamLead,
  });
  // recruiter ids under this team lead (may be app_user ids or profile ids depending on schema)
  const recruiterIdsUnderTL = new Set<string>();
  (candidates || []).forEach((c: any) => {
    if (!profile || c.team_lead_id !== profile.id) return;
    const rid = c.recruiter_id;
    if (!rid) return;
    recruiterIdsUnderTL.add(rid);
    // Also map recruiter profile.id -> app_user id if we have users loaded
    const matched = (users || []).find((u: any) => u.id === rid || u.user_id === rid);
    if (matched && matched.user_id) recruiterIdsUnderTL.add(matched.user_id);
  });
  // build deduped candidate options keyed by email or id
  const candidateOptionsMap = new Map<string, any>();
  (candidates || []).forEach((c: any) => {
    const key = c.email || c.id;
    if (!candidateOptionsMap.has(key)) candidateOptionsMap.set(key, c);
  });
  const candidateOptionList = Array.from(candidateOptionsMap.entries()).map(([key, c]) => ({ key, ...c }));

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

  const passwordMutation = useMutation({
    mutationFn: async ({ targetUserId, password }: { targetUserId: string; password: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await updateAppUserPassword(user.id, targetUserId, password);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Password updated");
      setPasswordDialogOpen(false);
      setPasswordTargetUser(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkCandidate = useMutation({
    mutationFn: async ({ profileId, candidateId }: { profileId: string; candidateId: string | null }) => {
      // Assign candidate to team lead (profileId is profiles.id of team lead)
      if (!candidateId) return;
      await updateCandidate(candidateId, { team_lead_id: profileId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Candidate linked");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetUser, setAssignTargetUser] = useState<any | null>(null);
  const [selectedAssignedCandidates, setSelectedAssignedCandidates] = useState<Set<string>>(new Set());
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const assignCandidatesMutation = useMutation({
    mutationFn: async ({ userId, candidateIds }: { userId: string; candidateIds: string[] }) => {
      // set team_lead_id for provided candidate ids to userId; set null for others previously assigned to userId
      const prev = (candidates || []).filter((c: any) => c.team_lead_id === userId).map((c: any) => c.id);
      const toUnset = prev.filter((id) => !candidateIds.includes(id));
      const toSet = candidateIds.filter((id) => !prev.includes(id));
      await Promise.all([
        ...toSet.map((cid) => updateCandidate(cid, { team_lead_id: userId })),
        ...toUnset.map((cid) => updateCandidate(cid, { team_lead_id: null })),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-candidates-for-linking"] });
      toast.success("Team updated");
      setAssignDialogOpen(false);
      setAssignTargetUser(null);
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

  /* Create user OR create invite for candidates.
     If role === 'candidate' we create an invite record with a token,
     generate a link and POST to a configurable webhook (Power Automate).
     For other roles we continue to create the user with a password. */
  const createUserMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      // Guard: only admin/manager/team_lead may create users
      if (!(isAdmin || isManager || isTeamLead)) throw new Error("Not authorized to create users");
      const role = (fd.get("role") as string) || selectedRole;
      const email = fd.get("email") as string;
      const fullName = fd.get("full_name") as string;
      // Candidates should always be invited (invite token + webhook)
      if (role === "candidate") {
        const token = crypto.randomUUID();
        const { createInvite } = await import("../../dbscripts/functions/invites");
        await createInvite({ token, email, full_name: fullName, role, created_by: user?.id || "" });
        const inviteLink = `${window.location.origin}/set-password?token=${token}`;
        const webhook = import.meta.env.VITE_INVITE_WEBHOOK as string | undefined;
        if (webhook) {
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: fullName, email, link: inviteLink }),
          });
        }
        return { invited: true, inviteLink };
      }

      // All non-candidate roles (recruiter, manager, admin, team_lead) are created directly
      // Password must be provided by the creator (hidden for candidate creation)
      const password = fd.get("password") as string;
      if (!password) throw new Error("Password is required for non-candidate accounts");
      const { error } = await createUser(email, password, fullName, role);
      if (error) throw error;
      return { invited: false };
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateDialogOpen(false);
      if (res?.invited) {
        toast.success("Invite created and sent.");
      } else {
        toast.success("User created. They can sign in with their email and password.");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!(isAdmin || isManager || isTeamLead)) {
    // allow access for admin, manager, and team lead
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground">Manage team members, roles, and candidate assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="tabs inline-flex rounded-md bg-muted p-1">
            <button
              className={`px-3 py-1 rounded ${activeTab === "team" ? "bg-background font-medium" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("team")}
            >
              Team
            </button>
            <button
              className={`px-3 py-1 rounded ${activeTab === "candidates" ? "bg-background font-medium" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("candidates")}
            >
              Candidates
            </button>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            {/* Only Admin, Manager, or Team Lead may create users */}
            {(isAdmin || isManager || isTeamLead) && (
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Create User</Button>
              </DialogTrigger>
            )}
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
              {/* If creating candidate from Candidates tab, enforce role=candidate and hide role selector/password */}
              {activeTab === "candidates" ? (
                // Candidates tab: role is candidate and we don't collect password (invite)
                <input type="hidden" name="role" value="candidate" />
              ) : (
                <>
                  {/* Password is only required for non-candidate roles */}
                  {/* If current user is team_lead, they can only create recruiter or candidate */}
                  {(selectedRole !== "candidate" && (!isTeamLead || selectedRole === "recruiter")) && (
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input name="password" type="password" required minLength={6} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <input type="hidden" name="role" value={selectedRole} />
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                    { (isTeamLead ? ["recruiter","candidate"] : ROLES.filter(r => r !== "candidate")) .map((r) => {
                          const label = r === "team_lead" ? "Team Lead" : r.replace('_',' ').replace(/\b\w/g, c => c.toUpperCase());
                          return <SelectItem key={r} value={r}><Badge variant={r === "admin" ? "default" : "secondary"} className="capitalize">{label}</Badge></SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <Button type="submit" className="w-full" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
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
                  <TableHead>Change Password</TableHead>
                  <TableHead>Linked Candidate</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                { (users?.filter((u:any) => {
                      if (activeTab === "team") {
                        if (isTeamLead) {
                          // show self and recruiters assigned to this TL
                          return u.user_id === user?.id || (u.role === "recruiter" && recruiterIdsUnderTL.has(u.user_id));
                        }
                        return u.role !== "candidate";
                      }
                      return u.role === "candidate";
                    }) || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No users found</TableCell>
                  </TableRow>
                ) : (
                  users?.filter((u:any) => {
                      if (activeTab === "team") {
                        if (isTeamLead) {
                          return u.user_id === user?.id || (u.role === "recruiter" && recruiterIdsUnderTL.has(u.user_id));
                        }
                        return u.role !== "candidate";
                      }
                      return u.role === "candidate";
                    }).map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                      {isTeamLead && (u.role === "candidate" || u.role === "recruiter") ? (
                        // Team Leads may not change candidate or recruiter roles
                        <Badge className="capitalize">{u.role}</Badge>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(v) => updateRoleMutation.mutate({ userId: u.user_id, roleId: u.roleId, newRole: v })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            { (activeTab === "team" ? ROLES.filter(r => r !== "candidate") : ROLES).map((r) => (
                              <SelectItem key={r} value={r}>
                                <Badge variant={r === "admin" ? "default" : "secondary"} className="capitalize">{r}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      </TableCell>
                      <TableCell>
                        {u.role === "team_lead" ? (
                          <>
                            <div className="text-sm">{new Set((candidates || []).filter((c:any) => c.team_lead_id === u.id).map((c:any) => c.email || c.id)).size} members</div>
                            <div className="mt-2">
                              {(isAdmin || isManager) ? (
                                <Button size="sm" onClick={() => {
                                  setAssignTargetUser(u);
                                  // prepare selected set (use deduped keys email||id)
                                  const preKeys = new Set((candidates || []).filter((c:any) => c.team_lead_id === u.id).map((c:any) => c.email || c.id));
                                  setSelectedAssignedCandidates(preKeys);
                                  setAssignDialogOpen(true);
                                }}>Manage Team</Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">Managed by Admin</span>
                              )}
                            </div>
                          </>
                        ) : u.role === "candidate" ? (
                          <span className="text-muted-foreground text-xs">Managed via Candidates tab</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(isAdmin || isManager || isTeamLead) && (
                          <div className="mt-1">
                            <Button size="sm" variant="ghost" onClick={() => { setPasswordTargetUser(u); setNewPassword(""); setPasswordDialogOpen(true); }}>
                              Change Password
                            </Button>
                          </div>
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
      {/* Assign team dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Team for {assignTargetUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {candidateOptionList.map((c: any) => {
              const checked = selectedAssignedCandidates.has(c.key);
              return (
                <div key={c.key} className="flex items-center gap-2">
                  <input type="checkbox" checked={checked} onChange={(e) => {
                    const next = new Set(selectedAssignedCandidates);
                    if (e.target.checked) next.add(c.key); else next.delete(c.key);
                    setSelectedAssignedCandidates(next);
                  }} />
                  <div>{c.first_name} {c.last_name || ""} {c.email ? `— ${c.email}` : ""}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!assignTargetUser) return;
              // Resolve selected keys to actual candidate ids (assign all candidates sharing the key)
              const selectedKeys = Array.from(selectedAssignedCandidates);
              const candidateIdsToAssign: string[] = [];
              selectedKeys.forEach((key) => {
                (candidates || []).forEach((c: any) => {
                  if ((c.email || c.id) === key) candidateIdsToAssign.push(c.id);
                });
              });
              assignCandidatesMutation.mutate({ userId: assignTargetUser.id, candidateIds: candidateIdsToAssign });
            }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Password for {passwordTargetUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setPasswordDialogOpen(false); setPasswordTargetUser(null); }}>Cancel</Button>
              <Button disabled={!newPassword || newPassword.length < 6} onClick={() => {
                if (!passwordTargetUser) return;
                passwordMutation.mutate({ targetUserId: passwordTargetUser.user_id || passwordTargetUser.id, password: newPassword });
              }}>{passwordMutation.isPending ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
