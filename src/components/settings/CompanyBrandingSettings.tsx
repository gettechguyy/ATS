import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Briefcase, ImagePlus, Trash2 } from "lucide-react";
import {
  fetchAgencyBranding,
  fetchCompanyBranding,
  updateAgencyBranding,
  updateCompanyBranding,
} from "../../../dbscripts/functions/tenantBranding";
import { deleteTenantLogoFromStorage, uploadTenantLogo } from "../../../dbscripts/functions/storage";

const ACCEPTED_LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";

export function CompanyBrandingSettings() {
  const { isAdmin, isAgencyAdmin, profile, company, updateSessionCompany } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const agencyId = isAgencyAdmin ? profile?.agency_id ?? null : null;
  const companyId = isAdmin && !isAgencyAdmin ? profile?.company_id ?? company?.id ?? null : null;
  const canEditAgency = isAgencyAdmin && !!agencyId;
  const canEditCompany = isAdmin && !isAgencyAdmin && !!companyId;

  if (!canEditAgency && !canEditCompany) return null;

  const scope = canEditAgency ? ("agency" as const) : ("company" as const);
  const tenantId = canEditAgency ? agencyId! : companyId!;

  const { data: branding, isLoading } = useQuery({
    queryKey: ["tenant-branding-settings", scope, tenantId],
    queryFn: () =>
      scope === "agency" ? fetchAgencyBranding(tenantId) : fetchCompanyBranding(tenantId),
    enabled: !!tenantId,
  });

  const [displayName, setDisplayName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const logoDirtyRef = useRef(false);

  useEffect(() => {
    if (!branding) return;
    setDisplayName(branding.name ?? "");
    if (!logoDirtyRef.current) {
      setLogoPreview(branding.logo_url ?? null);
      setRemoveLogo(false);
    }
  }, [branding]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = displayName.trim();
      if (!name) throw new Error("Display name is required");

      let logoUrl: string | null | undefined = undefined;
      if (removeLogo) {
        await deleteTenantLogoFromStorage(tenantId);
        logoUrl = null;
      } else if (pendingLogoFile) {
        logoUrl = await uploadTenantLogo(tenantId, pendingLogoFile);
      }

      if (scope === "agency") {
        await updateAgencyBranding(tenantId, {
          name,
          ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
        });
      } else {
        await updateCompanyBranding(tenantId, {
          name,
          ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
        });
      }
      return { name, logoUrl, removed: removeLogo };
    },
    onSuccess: ({ name, logoUrl, removed }) => {
      const brandingKey =
        scope === "agency"
          ? (["tenant-branding", "agency", tenantId] as const)
          : (["tenant-branding", "company", tenantId] as const);

      queryClient.setQueryData(brandingKey, (prev: { id: string; name: string; logo_url: string | null } | undefined) =>
        prev ? { ...prev, name, logo_url: removed ? null : logoUrl ?? prev.logo_url } : prev
      );
      queryClient.setQueryData(
        ["tenant-branding-settings", scope, tenantId],
        (prev: { id: string; name: string; logo_url: string | null } | undefined) =>
          prev ? { ...prev, name, logo_url: removed ? null : logoUrl ?? prev.logo_url } : prev
      );

      queryClient.invalidateQueries({ queryKey: ["tenant-branding"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-branding-settings"] });

      if (scope === "company") {
        updateSessionCompany({ name });
      }
      if (removed || logoUrl === null) {
        setLogoPreview(null);
      } else if (logoUrl) {
        setLogoPreview(logoUrl);
      }
      setPendingLogoFile(null);
      setRemoveLogo(false);
      logoDirtyRef.current = false;
      toast.success("Branding saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onPickLogo = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP, or SVG)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller");
      return;
    }
    logoDirtyRef.current = true;
    setPendingLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  };

  const title = scope === "agency" ? "Agency branding" : "Company branding";
  const description =
    scope === "agency"
      ? "Customize how your agency appears in the sidebar for you and your team."
      : "Customize how your company appears in the sidebar for all users in your organization.";

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="tenant-name">{scope === "agency" ? "Agency name" : "Company name"}</Label>
          <Input
            id="tenant-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your organization name"
            maxLength={120}
          />
        </div>

        <div className="space-y-3">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand text-primary-foreground shadow-brand">
              {logoPreview && !removeLogo ? (
                <img src={logoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <Briefcase className="h-6 w-6" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_LOGO_TYPES}
                className="hidden"
                onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm" className="interactive-3d" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4" />
                Upload logo
              </Button>
              {(logoPreview || branding?.logo_url) && !removeLogo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="interactive-3d text-destructive hover:text-destructive"
                  onClick={() => {
                    logoDirtyRef.current = true;
                    setRemoveLogo(true);
                    setPendingLogoFile(null);
                    setLogoPreview(null);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored in Supabase at <code className="text-[11px]">logo/{tenantId}/logo.*</code>. If no logo is set, the
            briefcase icon is shown.
          </p>
        </div>

        <Button
          className="interactive-3d w-full sm:w-auto"
          disabled={saveMutation.isPending || !displayName.trim()}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
