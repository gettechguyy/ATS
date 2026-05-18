import { useTheme } from "next-themes";
import { CircleCheck, CircleX, Info, Loader2, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      closeButton
      richColors={false}
      expand
      visibleToasts={4}
      gap={10}
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} />,
        error: <CircleX className="h-5 w-5 shrink-0" strokeWidth={2.25} />,
        warning: <TriangleAlert className="h-5 w-5 shrink-0" strokeWidth={2.25} />,
        info: <Info className="h-5 w-5 shrink-0" strokeWidth={2.25} />,
        loading: <Loader2 className="h-5 w-5 shrink-0 animate-spin" strokeWidth={2.25} />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-xl !font-sans group-[.toaster]:text-foreground",
          title: "text-sm font-semibold tracking-tight",
          description: "text-sm opacity-90",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          closeButton:
            "!border-border/60 !bg-background/80 !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
