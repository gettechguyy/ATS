import { useState } from "react";
import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  User,
  FileText,
  Calendar,
  Gift,
  LogOut,
  X,
  ChevronLeft,
  Briefcase,
  Shield,
  Building2,
  Bell,
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
import { cn, isNavLinkActive } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCandidateById } from "../../dbscripts/functions/candidates";
import { fetchEducationsByCandidate } from "../../dbscripts/functions/educations";
import { fetchExperiencesByCandidate } from "../../dbscripts/functions/experiences";
import { TopBar } from "@/components/layout/TopBar";
import { CommandMenu, type CommandNavItem } from "@/components/layout/CommandMenu";
import { spring } from "@/lib/motion";

const allNavItems: (CommandNavItem & { roles: string[]; masterOnly?: boolean })[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/candidates", icon: Users, label: "Candidates", roles: ["admin", "recruiter", "manager", "team_lead", "agency_admin"], keywords: "people talent" },
  { to: "/my-profile", icon: User, label: "My Profile", roles: ["candidate"] },
  { to: "/submissions", icon: FileText, label: "Applications", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/submissions-vendor", icon: FileText, label: "Submission", roles: ["admin", "recruiter", "manager", "team_lead", "agency_admin"] },
  { to: "/interviews", icon: Calendar, label: "Interviews", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/offers", icon: Gift, label: "Offers", roles: ["admin", "recruiter", "candidate", "manager", "team_lead", "agency_admin"] },
  { to: "/admin/agencies", icon: Building2, label: "Agencies", roles: ["admin"], masterOnly: true },
  { to: "/admin/users", icon: Shield, label: "User Management", roles: ["admin", "manager", "team_lead", "agency_admin"] },
  { to: "/activity", icon: Bell, label: "Activity", roles: ["admin"], keywords: "notifications alerts" },
];

function useCandidateProfileComplete(candidateId: string | null) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const { data: candidate } = useQuery({
    queryKey: ["candidate-profile-complete", candidateId, companyId],
    queryFn: () => fetchCandidateById(candidateId!, companyId),
    enabled: !!candidateId && !!companyId,
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
  const c = candidate as Record<string, unknown>;
  const isBasic = Boolean(
    (c.first_name as string)?.trim() &&
      (c.last_name as string)?.trim() &&
      c.visa_status &&
      ((c.email as string)?.trim() || (c.phone as string)?.trim())
  );
  const isProfessional = Boolean(
    (c.technology as string)?.trim() &&
      c.experience_years != null &&
      c.experience_years !== "" &&
      (c.primary_skills as string)?.trim() &&
      (c.target_role as string)?.trim() &&
      c.expected_salary != null &&
      (c.interview_availability as string)?.trim()
  );
  const complete = isBasic && isProfessional && (educations?.length ?? 0) >= 1 && (experiences?.length ?? 0) >= 1;
  return { complete, loading: false };
}

export default function AppLayout() {
  const { user, profile, role, loading, signOut, company, isMasterCompany, isAdmin } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCandidate = role === "candidate";
  const linkedCandidateId = profile?.linked_candidate_id ?? null;
  const { complete: candidateProfileComplete, loading: candidateProfileLoading } =
    useCandidateProfileComplete(isCandidate ? linkedCandidateId : null);
  const isOnOwnCandidatePage =
    isCandidate && linkedCandidateId && location.pathname === `/candidates/${linkedCandidateId}`;
  const showCompleteProfileModal =
    isCandidate && !!linkedCandidateId && !candidateProfileLoading && !candidateProfileComplete && !isOnOwnCandidatePage;

  if (loading) {
    return (
      <motion.div
        className="flex min-h-screen items-center justify-center app-mesh-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="space-y-3 text-center">
          <Skeleton className="mx-auto h-12 w-12 rounded-2xl" />
          <Skeleton className="h-4 w-40" />
        </div>
      </motion.div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role === "agency_admin" && !isMasterCompany) return <Navigate to="/" replace />;

  const navItems = allNavItems.filter(
    (item) => item.roles.includes(role || "recruiter") && (!item.masterOnly || isMasterCompany)
  );

  return (
    <div className="flex min-h-screen w-full min-w-0 app-mesh-bg overflow-x-hidden">
      <CommandMenu items={navItems} />

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg shadow-primary/5 backdrop-blur-xl transition-[width] duration-300 ease-out lg:relative lg:shrink-0",
          collapsed ? "w-[76px]" : "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        initial={false}
        animate={{ width: collapsed ? 76 : 260 }}
        transition={spring}
      >
        <motion.div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-border/80 px-3",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <motion.div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-brand"
            whileHover={{ scale: 1.05 }}
            transition={spring}
          >
            <Briefcase className="h-5 w-5" />
          </motion.div>
          {!collapsed && (
            <motion.div className="min-w-0 flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span className="block text-base font-semibold tracking-tight text-sidebar-foreground">HireTrack</span>
              {company?.name ? (
                <span className="block truncate text-xs text-sidebar-foreground/60" title={company.name}>
                  {company.name}
                </span>
              ) : null}
            </motion.div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "hidden h-9 w-9 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-primary lg:flex",
              collapsed && "ml-0"
            )}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-sidebar-foreground lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </motion.div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3">
          <p className={cn("mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40", collapsed && "sr-only")}>
            Workspace
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const active = isNavLinkActive(location.pathname, item.to);
              const link = (
                <Link
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  data-active={active}
                  className={cn(
                    "sidebar-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                    collapsed ? "justify-center px-0" : "",
                    !active && "text-sidebar-foreground/75"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 shrink-0", active && "text-white")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
              return (
                <li key={item.to}>
                  {collapsed ? (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
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

        <div className={cn("border-t border-sidebar-border/80 p-3", collapsed && "flex flex-col items-center")}>
          <motion.div
            className={cn(
              "flex items-center gap-3 rounded-xl border border-sidebar-border/50 bg-sidebar-accent/40 p-2 backdrop-blur-sm",
              collapsed && "justify-center border-0 bg-transparent p-0"
            )}
            whileHover={{ backgroundColor: "hsl(var(--sidebar-accent-hover))" }}
          >
            <motion.div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white shadow-brand">
              {profile?.full_name?.trim()?.charAt(0)?.toUpperCase() || "U"}
            </motion.div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name}</p>
                <p className="truncate text-xs capitalize text-sidebar-foreground/60">
                  {role === "agency_admin" ? "Admin" : role}
                </p>
              </div>
            )}
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-primary"
                    onClick={signOut}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        </div>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          companyName={company?.name}
          userName={profile?.full_name}
          role={role}
          userId={user?.id}
          companyId={profile?.company_id}
          isAdmin={isAdmin}
          onMenuClick={() => setMobileOpen(true)}
          showMobileMenu
        />
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="min-w-0 p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <Dialog open={showCompleteProfileModal} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Complete your profile</DialogTitle>
            <DialogDescription>
              Please fill in all required details: Basic details, Professional details, and add at least one
              Education and one Experience. You cannot use other screens until your profile is complete.
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
