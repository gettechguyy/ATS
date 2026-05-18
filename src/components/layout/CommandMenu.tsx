import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export type CommandNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
};

type CommandMenuProps = {
  items: CommandNavItem[];
};

export function CommandMenu({ items }: CommandMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, candidates, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {items.map((item) => (
            <CommandItem
              key={item.to}
              value={`${item.label} ${item.keywords ?? ""}`}
              onSelect={() => {
                navigate(item.to);
                setOpen(false);
              }}
              className="gap-3"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => { navigate("/candidates"); setOpen(false); }}>
            Browse candidates
          </CommandItem>
          <CommandItem onSelect={() => { navigate("/submissions"); setOpen(false); }}>
            View applications
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandMenuTrigger() {
  const [open, setOpen] = useState(false);
  return { openCommand: () => setOpen(true) };
}
