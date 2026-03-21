import { useState } from "react";
import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  User,
  FileText,
  Calendar,
  Gift,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Briefcase,
  Shield,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCandidateById } from "../../dbscripts/functions/candidates";
import { fetchEducationsByCandidate } from "../../dbscripts/functions/educations";
import { fetchExperiencesByCandidate } from "../../dbscripts/functions/experiences";

const allNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/candidates", icon: Users, label: "Candidates", roles: ["admin", "recruiter", "manager", "team_lead", "agency_admin"] },
  { to: "/my-profile", icon: User, label: "My Profile", roles: ["candidate"] },
  { to: "/submissions", icon: FileText, label: "Applications", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/submissions-vendor", icon: FileText, label: "Submission", roles: ["admin", "recruiter", "manager", "team_lead", "agency_admin"] },
  { to: "/screens", icon: Calendar, label: "Screens", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/interviews", icon: Calendar, label: "Interviews", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/offers", icon: Gift, label: "Offers", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/admin/agencies", icon: Building2, label: "Agencies", roles: ["admin"] },
  { to: "/admin/users", icon: Shield, label: "User Management", roles: ["admin", "manager", "team_lead", "agency_admin"] },
];

function useCandidateProfileComplete(candidateId: string | null) {
  const { data: candidate } = useQuery({
    queryKey: ["candidate-profile-complete", candidateId],
    queryFn: () => fetchCandidateById(candidateId!),
    enabled: !!candidateId,
  });
  const { data: educations } = useQuery({
    queryKey: ["candidate-educations-complete", candidateId],
    queryFn: () => fetchEducationsByCandidate(candidateId!),
    enabled: !!candidateId,
  });
  const { data: experiences } = useQuery({
    queryKey: ["candidate-experiences-complete", candidateId],
    queryFn: () => fetchExperiencesByCandidate(candidateId!),
    enabled: !!candidateId,
  });
  if (!candidateId || !candidate) return { complete: false, loading: !!candidateId };
  const c = candidate as any;
  const isBasic = Boolean(c?.first_name?.trim() && c?.last_name?.trim() && c?.visa_status && (c?.email?.trim() || c?.phone?.trim()));
  const isProfessional = Boolean(
    c?.technology?.trim() && c?.experience_years != null && c?.experience_years !== "" && c?.primary_skills?.trim() && c?.target_role?.trim() && c?.expected_salary != null && c?.interview_availability?.trim()
  );
  const complete = isBasic && isProfessional && (educations?.length ?? 0) >= 1 && (experiences?.length ?? 0) >= 1;
  return { complete, loading: false };
}

export default function AppLayout() {
  const { user, profile, role, isAdmin, loading, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCandidate = role === "candidate";
  const linkedCandidateId = profile?.linked_candidate_id ?? null;
  const { complete: candidateProfileComplete, loading: candidateProfileLoading } = useCandidateProfileComplete(isCandidate ? linkedCandidateId : null);
  const isOnOwnCandidatePage = isCandidate && linkedCandidateId && location.pathname === `/candidates/${linkedCandidateId}`;
  const showCompleteProfileModal = isCandidate && !!linkedCandidateId && !candidateProfileLoading && !candidateProfileComplete && !isOnOwnCandidatePage;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const navItems = allNavItems.filter((item) => item.roles.includes(role || "recruiter"));

  return (
    <div className="flex min-h-screen w-full min-w-0 bg-background overflow-x-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-[width] duration-300 ease-in-out lg:relative lg:shrink-0",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-border px-3 transition-[padding] duration-300",
            collapsed ? "justify-center px-0" : "gap-3"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent/80 text-sidebar-primary">
            <Briefcase className="h-5 w-5" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight text-sidebar-primary">
              HireTrack
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "ml-auto hidden h-9 w-9 rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-primary lg:flex",
              collapsed && "ml-0"
            )}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-9 w-9 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 pt-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active =
                location.pathname === item.to ||
                (item.to !== "/" && location.pathname.startsWith(item.to));
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  data-active={active}
                  className={cn(
                    "sidebar-nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    collapsed ? "justify-center px-0 py-3" : "",
                    !active && "text-sidebar-foreground/90"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
              return (
                <li key={item.to}>
                  {collapsed ? (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8} className="font-medium">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer / User */}
        <div
          className={cn(
            "border-t border-sidebar-border p-3",
            collapsed && "flex flex-col items-center gap-2 px-0"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent/50",
              collapsed && "justify-center px-0"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-accent to-sidebar-primary/30 text-sm font-semibold text-sidebar-primary">
              {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-primary">
                  {profile?.full_name}
                </p>
                <p className="truncate text-xs capitalize text-sidebar-foreground/80">{role === "agency_admin" ? "Admin" : role}</p>
              </div>
            )}
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-primary"
                    onClick={signOut}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Sign out
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold">HireTrack</span>
        </div>
        <div className="min-w-0 p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Candidate: block navigation until profile is complete; show modal with link to profile page */}
      <Dialog open={showCompleteProfileModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Complete your profile</DialogTitle>
            <DialogDescription>
              Please fill in all required details: Basic details, Professional details, and add at least one Education and one Experience. You cannot use other screens until your profile is complete.
            </DialogDescription>
          </DialogHeader>
          <Button asChild className="w-full">
            <Link to={linkedCandidateId ? `/candidates/${linkedCandidateId}` : "/"}>Complete my profile</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
