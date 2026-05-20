import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addTestApplication,
  addTestCandidate,
  addTestTeam,
  addTestUser,
  clearTestCache,
  getTestCacheForCompany,
  isTestCacheOwner,
  removeTestCacheItem,
} from "@/lib/testDataCache";

const ROLES = ["recruiter", "team_lead", "manager", "admin", "candidate"] as const;
const STATUSES = ["Applied", "Vendor Responded", "Assessment", "Screen Call", "Interview", "Rejected", "Offered"] as const;

export function TestDataCachePanel() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  if (!isTestCacheOwner(user?.email)) return null;
  const companyId = profile?.company_id;
  if (!companyId) return null;

  const store = getTestCacheForCompany(companyId);

  const invalidateAll = () => {
    queryClient.invalidateQueries();
    toast.success("Lists refreshed with test cache data");
  };

  const [cFirst, setCFirst] = useState("Test");
  const [cLast, setCLast] = useState("Candidate");
  const [cEmail, setCEmail] = useState("test.candidate@example.com");
  const [uName, setUName] = useState("Test User");
  const [uEmail, setUEmail] = useState("test.user@example.com");
  const [uRole, setURole] = useState<string>("recruiter");
  const [aClient, setAClient] = useState("Acme Corp");
  const [aPosition, setAPosition] = useState("Software Engineer");
  const [aStatus, setAStatus] = useState<string>("Applied");
  const [aCandidateId, setACandidateId] = useState<string>("");
  const [aCreatedBy, setACreatedBy] = useState<string>("__self__");
  const [teamName, setTeamName] = useState("Test Team Alpha");
  const [teamMgrId, setTeamMgrId] = useState("none");
  const [teamTlId, setTeamTlId] = useState("none");
  const [uManagerId, setUManagerId] = useState("none");
  const [uTeamLeadId, setUTeamLeadId] = useState("none");

  const cachedManagers = store.users.filter((u) => u.role === "manager");
  const cachedTeamLeads = store.users.filter((u) => u.role === "team_lead");

  const handleAddCandidate = () => {
    if (!cFirst.trim()) {
      toast.error("First name is required");
      return;
    }
    const row = addTestCandidate(companyId, {
      first_name: cFirst,
      last_name: cLast,
      email: cEmail,
      recruiter_id: user?.id ?? null,
    });
    setACandidateId(row.id);
    invalidateAll();
    toast.success("Test candidate saved to cache");
  };

  const handleAddUser = () => {
    if (!uName.trim() || !uEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    addTestUser(companyId, {
      full_name: uName,
      email: uEmail,
      role: uRole,
      manager_profile_id: uRole === "team_lead" && uManagerId !== "none" ? uManagerId : null,
      team_lead_profile_id: uRole === "recruiter" && uTeamLeadId !== "none" ? uTeamLeadId : null,
    });
    invalidateAll();
    toast.success("Test user saved to cache");
  };

  const handleAddApplication = () => {
    const cid = aCandidateId || store.candidates[0]?.id;
    if (!cid) {
      toast.error("Add a test candidate first or pick one");
      return;
    }
    if (!aClient.trim()) {
      toast.error("Client name is required");
      return;
    }
    const createdBy =
      aCreatedBy === "__self__"
        ? {
            kind: "session" as const,
            userId: user!.id,
            profileId: profile?.id,
            fullName: profile?.full_name ?? "You",
            role: "admin",
          }
        : { kind: "cached_user" as const, profileId: aCreatedBy };

    addTestApplication(companyId, {
      candidate_id: cid,
      client_name: aClient,
      position: aPosition,
      status: aStatus,
      createdBy,
    });
    invalidateAll();
    toast.success("Test application saved to cache");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-dashed">
          <FlaskConical className="h-4 w-4" />
          Test data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Local test data cache</DialogTitle>
          <DialogDescription>
            Data is stored in this browser only for {user?.email}. Use it to test teams,
            candidates, users, and applications without hitting the database.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="add">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">Add</TabsTrigger>
            <TabsTrigger value="manage">
              Manage ({store.candidates.length + store.users.length + store.applications.length + (store.teams?.length ?? 0)})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-6 pt-2">
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Candidate</p>
              <div className="grid gap-2">
                <div>
                  <Label>First name</Label>
                  <Input value={cFirst} onChange={(e) => setCFirst(e.target.value)} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={cLast} onChange={(e) => setCLast(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
                </div>
              </div>
              <Button size="sm" onClick={handleAddCandidate}>
                Add candidate to cache
              </Button>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">User (User Management list)</p>
              <div className="grid gap-2">
                <div>
                  <Label>Full name</Label>
                  <Input value={uName} onChange={(e) => setUName(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={uEmail} onChange={(e) => setUEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={uRole} onValueChange={setURole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r === "team_lead"
                            ? "Team Lead"
                            : r === "manager"
                              ? "Manager"
                              : r.charAt(0).toUpperCase() + r.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {uRole === "team_lead" && (
                  <div>
                    <Label>Reports to (Manager)</Label>
                    <Select value={uManagerId} onValueChange={setUManagerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Unassigned —</SelectItem>
                        {cachedManagers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add a cached manager first if the list is empty.
                    </p>
                  </div>
                )}
                {uRole === "recruiter" && (
                  <div>
                    <Label>Team lead</Label>
                    <Select value={uTeamLeadId} onValueChange={setUTeamLeadId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Team lead" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Unassigned —</SelectItem>
                        {cachedTeamLeads.map((tl) => (
                          <SelectItem key={tl.id} value={tl.id}>
                            {tl.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Button size="sm" onClick={handleAddUser}>
                Add user to cache
              </Button>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Application</p>
              <div className="grid gap-2">
                <div>
                  <Label>Candidate</Label>
                  <Select value={aCandidateId} onValueChange={setACandidateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cached or DB candidate id" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.candidates.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name} (cache)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Client</Label>
                  <Input value={aClient} onChange={(e) => setAClient(e.target.value)} />
                </div>
                <div>
                  <Label>Position</Label>
                  <Input value={aPosition} onChange={(e) => setAPosition(e.target.value)} />
                </div>
                <div>
                  <Label>Created by</Label>
                  <Select value={aCreatedBy} onValueChange={setACreatedBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Recruiter, team lead, or manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__self__">
                        You ({profile?.full_name ?? user?.email})
                      </SelectItem>
                      {store.users
                        .filter((u) => ["recruiter", "team_lead", "manager"].includes(u.role))
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name} (
                            {u.role === "team_lead"
                              ? "Team Lead"
                              : u.role === "manager"
                                ? "Manager"
                                : "Recruiter"}
                            )
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Counts on Dashboard and Teams charts use this person&apos;s activity.
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={aStatus} onValueChange={setAStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={handleAddApplication}>
                Add application to cache
              </Button>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Team</p>
              <div className="grid gap-2">
                <div>
                  <Label>Team name</Label>
                  <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>
                <div>
                  <Label>Manager</Label>
                  <Select value={teamMgrId} onValueChange={setTeamMgrId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Unassigned —</SelectItem>
                      {cachedManagers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Team lead</Label>
                  <Select value={teamTlId} onValueChange={setTeamTlId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {cachedTeamLeads.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!teamName.trim()) {
                    toast.error("Team name required");
                    return;
                  }
                  addTestTeam(companyId, {
                    name: teamName,
                    manager_profile_id: teamMgrId === "none" ? null : teamMgrId,
                    team_lead_profile_id: teamTlId === "none" ? null : teamTlId,
                  });
                  invalidateAll();
                  toast.success("Test team saved to cache");
                }}
              >
                Add team to cache
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manage" className="space-y-4 pt-2">
            {store.candidates.length === 0 && store.users.length === 0 && store.applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cached items yet.</p>
            ) : null}
            {store.candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="text-muted-foreground">Candidate:</span> {c.first_name} {c.last_name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    removeTestCacheItem(companyId, "candidate", c.id);
                    invalidateAll();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {store.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="text-muted-foreground">User:</span> {u.full_name} ({u.role})
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    removeTestCacheItem(companyId, "user", u.id);
                    invalidateAll();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {store.applications.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="text-muted-foreground">App:</span> {a.client_name} — {a.status}
                  {a.created_by_name ? (
                    <span className="text-muted-foreground">
                      {" "}
                      (by {a.created_by_name}
                      {a.created_by_role ? `, ${a.created_by_role.replace("_", " ")}` : ""})
                    </span>
                  ) : null}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    removeTestCacheItem(companyId, "application", a.id);
                    invalidateAll();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(store.teams || []).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="text-muted-foreground">Team:</span> {t.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    removeTestCacheItem(companyId, "team", t.id);
                    invalidateAll();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                clearTestCache();
                invalidateAll();
                toast.success("Test cache cleared");
              }}
            >
              Clear all test cache
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
