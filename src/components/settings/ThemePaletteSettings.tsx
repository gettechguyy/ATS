import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useThemePalette } from "@/contexts/ThemePaletteContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, Palette, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PRESET_ID,
  DEFAULT_THEME_PALETTE,
  prefsFromPreset,
  presetById,
  THEME_PRESETS,
  type ThemePalettePrefs,
} from "@/lib/themePalette";

export function ThemePaletteSettings() {
  const { palette, loading, applyPalette, savePalette, resetToDefault, isCustom } = useThemePalette();
  const [draft, setDraft] = useState<ThemePalettePrefs>(palette);

  useEffect(() => {
    if (!loading) setDraft(palette);
  }, [palette, loading]);

  const saveMutation = useMutation({
    mutationFn: () => savePalette(draft),
    onSuccess: () => toast.success("Theme saved"),
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetToDefault(),
    onSuccess: () => {
      setDraft(DEFAULT_THEME_PALETTE);
      toast.success("Theme reset to default");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectPreset = (presetId: string) => {
    const preset = presetById(presetId);
    const next = prefsFromPreset(preset);
    setDraft(next);
    applyPalette(next);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Color palette
        </CardTitle>
        <CardDescription>
          Personalize your app theme. Text and hovers stay high-contrast on any color you pick.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Choose a palette</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THEME_PRESETS.map((preset) => {
              const selected = draft.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    "interactive-3d group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/25"
                      : "border-border/70 bg-card hover:border-primary/40"
                  )}
                  onClick={() => selectPreset(preset.id)}
                >
                  <span
                    className="interactive-3d-swatch h-10 w-full rounded-lg shadow-inner"
                    style={{
                      background: `linear-gradient(135deg, hsl(${preset.primaryHue} 96% 58%), hsl(${preset.accentHue} 85% 62%))`,
                    }}
                  />
                  <span className="w-full truncate text-center text-xs font-semibold text-foreground">
                    {preset.label.replace(" (default)", "")}
                  </span>
                  {selected ? (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary-hue">Primary hue</Label>
            <input
              id="primary-hue"
              type="range"
              min={0}
              max={359}
              value={draft.primaryHue}
              className="interactive-3d-range w-full accent-primary"
              onChange={(e) => {
                const next = { ...draft, presetId: "custom", primaryHue: Number(e.target.value) };
                setDraft(next);
                applyPalette(next);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accent-hue">Accent hue</Label>
            <input
              id="accent-hue"
              type="range"
              min={0}
              max={359}
              value={draft.accentHue}
              className="interactive-3d-range w-full accent-primary"
              onChange={(e) => {
                const next = { ...draft, presetId: "custom", accentHue: Number(e.target.value) };
                setDraft(next);
                applyPalette(next);
              }}
            />
          </div>
        </div>

        <div
          className="interactive-3d rounded-xl border border-border/60 p-4"
          style={{
            background: `linear-gradient(135deg, hsl(${draft.primaryHue} 96% 58% / 0.15), hsl(${draft.accentHue} 85% 62% / 0.12))`,
          }}
        >
          <p className="text-sm font-semibold text-foreground">Live preview</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sidebar, buttons, and charts use these colors. Fonts stay bold and readable.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="interactive-3d shadow-brand">
              Primary action
            </Button>
            <Button size="sm" variant="outline" className="interactive-3d">
              Outline
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="interactive-3d"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save theme"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="interactive-3d"
            disabled={resetMutation.isPending || (!isCustom && draft.presetId === DEFAULT_PRESET_ID)}
            onClick={() => resetMutation.mutate()}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
