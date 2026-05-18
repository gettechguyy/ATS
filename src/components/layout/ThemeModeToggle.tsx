import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Automatic", icon: Monitor },
] as const;

type ThemeValue = (typeof MODES)[number]["value"];

export function ThemeModeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current: ThemeValue =
    theme === "light" || theme === "dark" || theme === "system" ? theme : "system";

  if (!mounted) {
    return (
      <div className={cn("px-3 py-2", className)}>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Appearance</p>
        <div className="grid h-9 grid-cols-3 gap-1 rounded-lg bg-muted/40" />
      </div>
    );
  }

  return (
    <div className={cn("px-3 py-2", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Appearance</p>
        {current === "system" ? (
          <span className="text-[10px] text-muted-foreground/80">
            Using {resolvedTheme === "dark" ? "dark" : "light"} (device)
          </span>
        ) : null}
      </div>
      <div
        className="grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-muted/30 p-1"
        role="radiogroup"
        aria-label="Theme"
      >
        {MODES.map(({ value, label, icon: Icon }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-2 text-[11px] font-medium transition-all",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} strokeWidth={2} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
