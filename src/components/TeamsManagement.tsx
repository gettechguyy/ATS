import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, UsersRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  assignRecruitersToTeam,
  createTeamRecord,
  deleteTeamRecord,
  fetchTeamRecords,
  updateTeamRecord,
  type TeamRecord,
} from "../../dbscripts/functions/teamRecords";
import { updateProfile } from "../../dbscripts/functions/profiles";

type Props = {
  users: any[];
  isAdmin: boolean;
  isManager: boolean;
  managerProfileId?: string;
};

export function TeamsManagement({ users, isAdmin, isManager, managerProfileId }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const companyId = profile?.company_id;

  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamRecord | null>(null);
  const [assignTeam, setAssignTeam] = useState<TeamRecord | null>(null);
  const [teamName, setTeamName] = useState("");
  const [managerId, setManagerId] = useState("none");
  const [teamLeadId, setTeamLeadId] = useState("none");
  const [selectedRecruiterIds, setSelectedRecruiterIds] = useState<Set<string>>(new Set());

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["company-teams", companyId, isManager ? managerProfileId : "all"],
    queryFn: () =>
      fetchTeamRecords(companyId!, {
        managerProfileId: isManager && managerProfileId ? managerProfileId : undefined,
      }),
    enabled: !!companyId && (isAdmin || isManager),
  });

  const managerOptions = useMemo(
    () => (users || []).filter((u) => u.role === "manager" && u.is_active !== false),
    [users]
  );
  const teamLeadOptions = useMemo(() => {
    let list = (users || []).filter((u) => u.role === "team_lead" && u.is_active !== false);
    if (isManager && managerProfileId) {
      list = list.filter((u) => u.manager_profile_id === managerProfileId);
    }
    return list;
  }, [users, isManager, managerProfileId]);

  const recruiterOptions = useMemo(() => (users || []).filter((u) => u.role === "recruiter"), [users]);

  const recruitersByTeam = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const u of recruiterOptions) {
      const tid = u.team_id;
      if (!tid) continue;
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(u);
    }
    return map;
  }, [recruiterOptions]);

  const tlName = (id: string | null) =>
    id ? teamLeadOptions.find((u) => u.id === id)?.full_name ?? "—" : "—";
  const mgrName = (id: string | null) =>
    id ? managerOptions.find((u) => u.id === id)?.full_name ?? "—" : "—";

  const resetForm = () => {
    setTeamName("");
    setManagerId(isManager && managerProfileId ? managerProfileId : "none");
    setTeamLeadId("none");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !teamName.trim()) throw new Error("Team name is required");
      const mgr =
        managerId !== "none"
          ? managerId
          : isManager && managerProfileId
            ? managerProfileId
            : null;
      const tl = teamLeadId !== "none" ? teamLeadId : null;
      return createTeamRecord({
        companyId,
        name: teamName,
        managerProfileId: mgr,
        teamLeadProfileId: tl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-teams"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateOpen(false);
      resetForm();
      toast.success("Team created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editTeam || !companyId) return;
      await updateTeamRecord(editTeam.id, companyId, {
        name: teamName,
        managerProfileId: managerId === "none" ? null : managerId,
        teamLeadProfileId: teamLeadId === "none" ? null : teamLeadId,
      });
      if (teamLeadId !== "none" && teamLeadId !== editTeam.team_lead_profile_id) {
        const tlUser = teamLeadOptions.find((u) => u.id === teamLeadId);
        if (tlUser?.user_id) {
          await updateProfile(tlUser.user_id, {
            manager_profile_id: managerId === "none" ? null : managerId,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-teams"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditTeam(null);
      toast.success("Team updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignTeam || !companyId) return;
      if (assignTeam.__testCache) {
        const { assignTestRecruitersToTeam } = await import("@/lib/testDataCache");
        assignTestRecruitersToTeam(companyId, assignTeam.id, [...selectedRecruiterIds]);
        return;
      }
      await assignRecruitersToTeam(assignTeam.id, companyId, [...selectedRecruiterIds]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setAssignTeam(null);
      toast.success("Recruiters assigned to team");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (team: TeamRecord) => {
      if (!companyId) return;
      if (team.__testCache) {
        const { removeTestCacheItem } = await import("@/lib/testDataCache");
        removeTestCacheItem(companyId, "team", team.id);
        return;
      }
      await deleteTeamRecord(team.id, companyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-teams"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Team removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (t: TeamRecord) => {
    setEditTeam(t);
    setTeamName(t.name);
    setManagerId(t.manager_profile_id ?? "none");
    setTeamLeadId(t.team_lead_profile_id ?? "none");
  };

  const openAssign = (t: TeamRecord) => {
    if (!t.team_lead_profile_id) {
      toast.error("Assign a team lead to this team first");
      return;
    }
    setAssignTeam(t);
    const current = recruitersByTeam.get(t.id)?.map((r) => r.id) ?? [];
    setSelectedRecruiterIds(new Set(current));
  };

  const toggleRecruiter = (profileId: string) => {
    setSelectedRecruiterIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  };

  if (!isAdmin && !isManager) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Only admins and managers can manage named teams.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Create named teams, assign a team lead, and add recruiters — used on the Teams progress page.
        </p>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create team</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Team name *</Label>
                <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Alpha Team" />
              </div>
              {isAdmin && (
                <div>
                  <Label>Manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Unassigned —</SelectItem>
                      {managerOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Team lead</Label>
                <Select value={teamLeadId} onValueChange={setTeamLeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Team lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Assign later —</SelectItem>
                    {teamLeadOptions.map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>
                        {tl.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create team"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team name</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Team lead</TableHead>
            <TableHead>Recruiters</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : teams.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No teams yet. Create one to group team leads and recruiters.
              </TableCell>
            </TableRow>
          ) : (
            teams.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-muted-foreground" />
                    {t.name}
                    {t.__testCache ? (
                      <Badge variant="outline" className="text-xs">
                        Test cache
                      </Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>{mgrName(t.manager_profile_id)}</TableCell>
                <TableCell>{tlName(t.team_lead_profile_id)}</TableCell>
                <TableCell>{(recruitersByTeam.get(t.id) ?? []).length}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => openAssign(t)}>
                      Recruiters
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!t.__testCache && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete team "${t.name}"?`)) deleteMutation.mutate(t);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={!!editTeam} onOpenChange={(o) => !o && setEditTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit team</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Team name</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </div>
            {isAdmin && (
              <div>
                <Label>Manager</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Team lead</Label>
              <Select value={teamLeadId} onValueChange={setTeamLeadId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {teamLeadOptions.map((tl) => (
                    <SelectItem key={tl.id} value={tl.id}>
                      {tl.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignTeam} onOpenChange={(o) => !o && setAssignTeam(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign recruiters — {assignTeam?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recruiterOptions.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRecruiterIds.has(r.id)}
                  onChange={() => toggleRecruiter(r.id)}
                />
                {r.full_name}
                <span className="text-muted-foreground text-xs">{r.email}</span>
              </label>
            ))}
          </div>
          <Button
            className="w-full mt-2"
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending ? "Saving…" : "Save assignments"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
