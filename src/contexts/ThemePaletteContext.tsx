import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import {
  applyThemePalette,
  clearThemePaletteOverrides,
  DEFAULT_THEME_PALETTE,
  isDefaultPalette,
  type ThemePalettePrefs,
} from "@/lib/themePalette";
import {
  fetchThemePreferences,
  resetThemePreferences,
  saveThemePreferences,
} from "../../dbscripts/functions/themePreferences";

type ThemePaletteContextValue = {
  palette: ThemePalettePrefs;
  loading: boolean;
  isCustom: boolean;
  setPalette: (prefs: ThemePalettePrefs) => void;
  applyPalette: (prefs: ThemePalettePrefs) => void;
  savePalette: (prefs: ThemePalettePrefs) => Promise<void>;
  resetToDefault: () => Promise<void>;
};

const ThemePaletteContext = createContext<ThemePaletteContextValue | undefined>(undefined);

export function ThemePaletteProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const [palette, setPaletteState] = useState<ThemePalettePrefs>(DEFAULT_THEME_PALETTE);
  const [loading, setLoading] = useState(true);

  const mode = resolvedTheme === "dark" ? "dark" : "light";

  const applyPalette = useCallback(
    (prefs: ThemePalettePrefs) => {
      setPaletteState(prefs);
      if (isDefaultPalette(prefs)) {
        clearThemePaletteOverrides();
      } else {
        applyThemePalette(prefs, mode);
      }
    },
    [mode]
  );

  useEffect(() => {
    if (isDefaultPalette(palette)) {
      clearThemePaletteOverrides();
    } else {
      applyThemePalette(palette, mode);
    }
  }, [mode, palette]);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.id) {
      setLoading(false);
      setPaletteState(DEFAULT_THEME_PALETTE);
      clearThemePaletteOverrides();
      return;
    }

    setLoading(true);
    fetchThemePreferences(profile.id)
      .then((prefs) => {
        if (cancelled) return;
        const next = prefs ?? DEFAULT_THEME_PALETTE;
        setPaletteState(next);
        if (isDefaultPalette(prefs)) {
          clearThemePaletteOverrides();
        } else if (prefs) {
          applyThemePalette(prefs, mode);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const savePalette = useCallback(
    async (prefs: ThemePalettePrefs) => {
      if (!profile?.id) throw new Error("Not signed in");
      const toSave = isDefaultPalette(prefs) ? null : prefs;
      await saveThemePreferences(profile.id, toSave);
      applyPalette(prefs);
    },
    [profile?.id, applyPalette]
  );

  const resetToDefault = useCallback(async () => {
    if (!profile?.id) throw new Error("Not signed in");
    await resetThemePreferences(profile.id);
    applyPalette(DEFAULT_THEME_PALETTE);
  }, [profile?.id, applyPalette]);

  const value = useMemo(
    () => ({
      palette,
      loading,
      isCustom: !isDefaultPalette(palette),
      setPalette: setPaletteState,
      applyPalette,
      savePalette,
      resetToDefault,
    }),
    [palette, loading, applyPalette, savePalette, resetToDefault]
  );

  return <ThemePaletteContext.Provider value={value}>{children}</ThemePaletteContext.Provider>;
}

export function useThemePalette() {
  const ctx = useContext(ThemePaletteContext);
  if (!ctx) throw new Error("useThemePalette must be used within ThemePaletteProvider");
  return ctx;
}
