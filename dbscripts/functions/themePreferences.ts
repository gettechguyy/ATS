import { supabase } from "../../src/integrations/supabase/client";
import {
  DEFAULT_THEME_PALETTE,
  parseThemePreferences,
  type ThemePalettePrefs,
} from "../../src/lib/themePalette";

export async function fetchThemePreferences(profileId: string): Promise<ThemePalettePrefs | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("theme_preferences")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    if (/theme_preferences|column/i.test(error.message)) {
      console.warn("theme_preferences column missing — run user theme migration");
      return null;
    }
    console.warn("fetchThemePreferences failed:", error.message);
    return null;
  }

  return parseThemePreferences((data as { theme_preferences?: unknown } | null)?.theme_preferences);
}

export async function saveThemePreferences(
  profileId: string,
  prefs: ThemePalettePrefs | null
): Promise<void> {
  const payload = prefs ?? null;
  const { error } = await supabase
    .from("profiles")
    .update({ theme_preferences: payload } as Record<string, unknown>)
    .eq("id", profileId);

  if (error) {
    if (/theme_preferences|column/i.test(error.message)) {
      throw new Error(
        "theme_preferences column is missing. Run supabase/migrations/20260520150000_user_theme_preferences.sql on Supabase."
      );
    }
    throw error;
  }
}

export async function resetThemePreferences(profileId: string): Promise<void> {
  await saveThemePreferences(profileId, null);
}

export { DEFAULT_THEME_PALETTE };
