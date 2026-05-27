import { ThemePaletteSettings } from "@/components/settings/ThemePaletteSettings";
import { CompanyBrandingSettings } from "@/components/settings/CompanyBrandingSettings";

export default function Settings() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Personalize your theme and workspace appearance.
        </p>
      </div>

      <ThemePaletteSettings />
      <CompanyBrandingSettings />
    </div>
  );
}
