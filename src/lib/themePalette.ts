/** HSL components without hsl() wrapper — matches index.css format: "H S% L%" */

export type ThemePalettePrefs = {
  presetId: string;
  primaryHue: number;
  accentHue: number;
};

export const DEFAULT_PRESET_ID = "hiretrack";

export const DEFAULT_THEME_PALETTE: ThemePalettePrefs = {
  presetId: DEFAULT_PRESET_ID,
  primaryHue: 217,
  accentHue: 270,
};

export type ThemePreset = ThemePalettePrefs & {
  id: string;
  label: string;
  swatch: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  { id: DEFAULT_PRESET_ID, label: "HireTrack (default)", primaryHue: 217, accentHue: 270, swatch: "#3b82f6" },
  { id: "ocean", label: "Ocean", primaryHue: 199, accentHue: 187, swatch: "#0ea5e9" },
  { id: "emerald", label: "Emerald", primaryHue: 152, accentHue: 160, swatch: "#10b981" },
  { id: "sunset", label: "Sunset", primaryHue: 32, accentHue: 340, swatch: "#f59e0b" },
  { id: "royal", label: "Royal", primaryHue: 270, accentHue: 217, swatch: "#8b5cf6" },
  { id: "rose", label: "Rose", primaryHue: 340, accentHue: 270, swatch: "#f43f5e" },
  { id: "crimson", label: "Crimson", primaryHue: 0, accentHue: 340, swatch: "#ef4444" },
  { id: "forest", label: "Forest", primaryHue: 142, accentHue: 85, swatch: "#22c55e" },
];

export function presetById(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

export function prefsFromPreset(preset: ThemePreset): ThemePalettePrefs {
  return { presetId: preset.id, primaryHue: preset.primaryHue, accentHue: preset.accentHue };
}

export function parseThemePreferences(raw: unknown): ThemePalettePrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const presetId = typeof o.presetId === "string" ? o.presetId : DEFAULT_PRESET_ID;
  if (presetId === DEFAULT_PRESET_ID) return null;
  const preset = presetById(presetId);
  const primaryHue = typeof o.primaryHue === "number" ? o.primaryHue : preset.primaryHue;
  const accentHue = typeof o.accentHue === "number" ? o.accentHue : preset.accentHue;
  return {
    presetId,
    primaryHue: clampHue(primaryHue),
    accentHue: clampHue(accentHue),
  };
}

function clampHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

function hslLuminance(h: number, s: number, l: number): number {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return color;
  };
  const r = f(0);
  const g = f(8);
  const b = f(4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Foreground on saturated brand surfaces — always readable */
export function contrastForeground(h: number, s: number, l: number): string {
  return hslLuminance(h, s, l) > 0.42 ? "222 47% 11%" : "0 0% 100%";
}

type Mode = "light" | "dark";

function buildCssVars(prefs: ThemePalettePrefs, mode: Mode): Record<string, string> {
  const ph = prefs.primaryHue;
  const ah = prefs.accentHue;
  const isDark = mode === "dark";

  const primaryL = isDark ? 62 : 58;
  const primaryS = 96;
  const accentL = isDark ? 65 : 62;
  const accentS = 85;
  const cyanHue = (ah + 17) % 360;

  const primaryFg = contrastForeground(ph, primaryS, primaryL);
  const sidebarActiveFg = contrastForeground(ph, primaryS, primaryL);

  const vars: Record<string, string> = {
    "--primary": `${ph} ${primaryS}% ${primaryL}%`,
    "--primary-foreground": primaryFg,
    "--ring": `${ph} ${primaryS}% ${primaryL}%`,
    "--brand-primary": `${ph} ${primaryS}% ${primaryL}%`,
    "--brand-violet": `${ah} ${accentS}% ${accentL}%`,
    "--brand-cyan": `${cyanHue} 92% ${isDark ? 52 : 48}%`,
    "--brand-rose": `${(ah + 70) % 360} 82% ${isDark ? 62 : 58}%`,
    "--sidebar-ring": `${ph} ${primaryS}% ${primaryL}%`,
    "--sidebar-active": `${ph} ${primaryS}% ${primaryL}%`,
    "--sidebar-active-foreground": sidebarActiveFg,
    "--chart-1": `${ph} ${primaryS}% ${primaryL}%`,
    "--chart-5": `${ah} ${accentS}% ${accentL}%`,
    "--shadow-glow": `0 0 48px -10px hsl(${ph} ${primaryS}% ${primaryL}% / 0.45)`,
  };

  if (isDark) {
    vars["--sidebar-accent"] = `${ph} 35% 18%`;
    vars["--sidebar-accent-hover"] = `${ph} 30% 24%`;
    vars["--accent"] = `${cyanHue} 50% 16%`;
    vars["--accent-foreground"] = `${cyanHue} 85% 65%`;
    vars["--secondary"] = `${ah} 35% 18%`;
    vars["--secondary-foreground"] = `${ah} 70% 82%`;
  } else {
    vars["--sidebar-accent"] = `${ph} 75% 96%`;
    vars["--sidebar-accent-hover"] = `${ph} 65% 93%`;
    vars["--accent"] = `${cyanHue} 85% 93%`;
    vars["--accent-foreground"] = `${cyanHue} 91% 32%`;
    vars["--secondary"] = `${ah} 55% 94%`;
    vars["--secondary-foreground"] = `${ah} 65% 42%`;
  }

  return vars;
}

function applyVarsToRoot(vars: Record<string, string>, dark: boolean) {
  const el = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => el.style.setProperty(key, value));
  if (dark) {
    el.classList.add("theme-palette-dark");
  } else {
    el.classList.remove("theme-palette-dark");
  }
}

export function clearThemePaletteOverrides() {
  const keys = [
    "--primary",
    "--primary-foreground",
    "--ring",
    "--brand-primary",
    "--brand-violet",
    "--brand-cyan",
    "--brand-rose",
    "--sidebar-ring",
    "--sidebar-active",
    "--sidebar-active-foreground",
    "--sidebar-accent",
    "--sidebar-accent-hover",
    "--accent",
    "--accent-foreground",
    "--secondary",
    "--secondary-foreground",
    "--chart-1",
    "--chart-5",
    "--shadow-glow",
  ];
  keys.forEach((k) => document.documentElement.style.removeProperty(k));
  document.documentElement.classList.remove("theme-palette-custom");
  document.documentElement.classList.remove("theme-palette-dark");
}

export function applyThemePalette(prefs: ThemePalettePrefs | null, resolvedMode: "light" | "dark") {
  if (!prefs || prefs.presetId === DEFAULT_PRESET_ID) {
    clearThemePaletteOverrides();
    return;
  }

  const mode: Mode = resolvedMode === "dark" ? "dark" : "light";
  const vars = buildCssVars(prefs, mode);
  applyVarsToRoot(vars, mode === "dark");
  document.documentElement.classList.add("theme-palette-custom");
}

export function isDefaultPalette(prefs: ThemePalettePrefs | null): boolean {
  return !prefs || prefs.presetId === DEFAULT_PRESET_ID;
}
