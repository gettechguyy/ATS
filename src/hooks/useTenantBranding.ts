import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAgencyBranding,
  fetchCompanyBranding,
  type TenantBranding,
} from "../../dbscripts/functions/tenantBranding";

export type ResolvedTenantBranding = {
  scope: "agency" | "company";
  tenantId: string;
  displayName: string;
  logoUrl: string | null;
};

function resolveFromRecord(
  scope: "agency" | "company",
  record: TenantBranding | null,
  fallbackName: string
): ResolvedTenantBranding | null {
  if (!record?.id) return null;
  return {
    scope,
    tenantId: record.id,
    displayName: record.name?.trim() || fallbackName,
    logoUrl: record.logo_url ?? null,
  };
}

export function useTenantBranding() {
  const { profile, company } = useAuth();
  const agencyId = profile?.agency_id ?? null;
  const companyId = profile?.company_id ?? company?.id ?? null;
  const fallbackName = company?.name?.trim() || "Workspace";

  const agencyQuery = useQuery({
    queryKey: ["tenant-branding", "agency", agencyId],
    queryFn: () => fetchAgencyBranding(agencyId!),
    enabled: !!agencyId,
    staleTime: 0,
  });

  const companyQuery = useQuery({
    queryKey: ["tenant-branding", "company", companyId],
    queryFn: () => fetchCompanyBranding(companyId!),
    enabled: !!companyId && !agencyId,
    staleTime: 0,
  });

  const loading = agencyId ? agencyQuery.isLoading : companyQuery.isLoading;

  if (agencyId) {
    const resolved =
      resolveFromRecord("agency", agencyQuery.data ?? null, fallbackName) ??
      ({
        scope: "agency" as const,
        tenantId: agencyId,
        displayName: fallbackName,
        logoUrl: null,
      } satisfies ResolvedTenantBranding);
    return { branding: resolved, loading };
  }

  if (companyId) {
    const resolved =
      resolveFromRecord("company", companyQuery.data ?? null, fallbackName) ??
      ({
        scope: "company" as const,
        tenantId: companyId,
        displayName: fallbackName,
        logoUrl: null,
      } satisfies ResolvedTenantBranding);
    return { branding: resolved, loading };
  }

  return {
    branding: {
      scope: "company" as const,
      tenantId: "",
      displayName: fallbackName,
      logoUrl: null,
    } satisfies ResolvedTenantBranding,
    loading: false,
  };
}
