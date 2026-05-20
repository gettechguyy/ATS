import { Link, useLocation } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeModeToggle } from "@/components/layout/ThemeModeToggle";
import { TestDataCachePanel } from "@/components/TestDataCachePanel";

type TopBarProps = {
  companyName?: string | null;
  userName?: string | null;
  role?: string | null;
  userId?: string | null;
  companyId?: string | null;
  isAdmin?: boolean;
  onMenuClick?: () => void;
  showMobileMenu?: boolean;
  breadcrumbs?: { label: string; href?: string }[];
};

export function TopBar({
  companyName,
  userName,
  role,
  userId,
  companyId,
  isAdmin,
  onMenuClick,
  showMobileMenu,
  breadcrumbs,
}: TopBarProps) {
  const location = useLocation();

  const crumbs =
    breadcrumbs ??
    (() => {
      const parts = location.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return [{ label: "Dashboard" }];
      return parts.map((p, i) => ({
        label: p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        href: i < parts.length - 1 ? "/" + parts.slice(0, i + 1).join("/") : undefined,
      }));
    })();

  const showNotifications = isAdmin && userId && companyId;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 md:h-16 md:px-6">
      {showMobileMenu ? (
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      ) : null}

      <nav className="hidden min-w-0 flex-1 items-center gap-1.5 text-sm md:flex">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 ? <span className="text-muted-foreground/50">/</span> : null}
            {crumb.href ? (
              <Link
                to={crumb.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
        <Button
          variant="outline"
          size="sm"
          className="field-surface hidden h-9 w-full max-w-xs justify-start gap-2 rounded-xl text-muted-foreground sm:flex md:max-w-[240px] lg:max-w-xs"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
          }}
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left text-sm">Search…</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border/80 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </Button>

        {showNotifications ? <NotificationBell userId={userId} companyId={companyId} /> : null}

        <TestDataCachePanel />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 rounded-xl px-2 pl-1">
              <motion.div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-semibold text-white shadow-brand"
                )}
                whileHover={{ scale: 1.04 }}
              >
                {userName?.trim()?.charAt(0)?.toUpperCase() || "U"}
              </motion.div>
              <span className="hidden max-w-[120px] truncate text-sm font-medium md:inline">
                {userName?.split(" ")[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-0">
            <DropdownMenuLabel className="px-4 py-3">
              <div className="font-medium">{userName}</div>
              <div className="text-xs font-normal capitalize text-muted-foreground">
                {role === "agency_admin" ? "Admin" : role}
              </div>
              {companyName ? (
                <div className="mt-1 truncate text-xs text-muted-foreground">{companyName}</div>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeModeToggle className="pb-3" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
