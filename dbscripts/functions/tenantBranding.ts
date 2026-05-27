import { supabase } from "../../src/integrations/supabase/client";
import { resolveTenantLogoFromStorage } from "./storage";

export type TenantBranding = {
  id: string;
  name: string;
  logo_url: string | null;
};

function isMissingLogoColumnError(message: string): boolean {
  return /logo_url|schema cache|column/i.test(message);
}

export async function fetchCompanyBranding(companyId: string): Promise<TenantBranding | null> {
  let { data, error } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("id", companyId)
    .maybeSingle();

  if (error && isMissingLogoColumnError(error.message)) {
    const fallback = await supabase.from("companies").select("id, name").eq("id", companyId).maybeSingle();
    data = fallback.data ? { ...fallback.data, logo_url: null } : null;
    error = fallback.error;
  }

  if (error) {
    console.warn("fetchCompanyBranding failed:", error.message);
    return null;
  }
  if (!data) return null;
  return data as TenantBranding;
}

export async function fetchAgencyBranding(agencyId: string): Promise<TenantBranding | null> {
  let { data, error } = await supabase
    .from("agencies")
    .select("id, name, logo_url")
    .eq("id", agencyId)
    .maybeSingle();

  if (error && isMissingLogoColumnError(error.message)) {
    const fallback = await supabase.from("agencies").select("id, name").eq("id", agencyId).maybeSingle();
    data = fallback.data ? { ...fallback.data, logo_url: null } : null;
    error = fallback.error;
  }

  if (error) {
    console.warn("fetchAgencyBranding failed:", error.message);
    return null;
  }
  if (!data) return null;
  return data as TenantBranding;
}

/** One-time sync: copy storage logo URL into DB when logo_url is empty (Settings only). */
export async function syncTenantLogoFromStorage(
  tenantId: string,
  scope: "company" | "agency"
): Promise<string | null> {
  const fromStorage = await resolveTenantLogoFromStorage(tenantId);
  if (!fromStorage) return null;
  if (scope === "company") {
    await updateCompanyBranding(tenantId, { logo_url: fromStorage });
  } else {
    await updateAgencyBranding(tenantId, { logo_url: fromStorage });
  }
  return fromStorage;
}

export async function updateCompanyBranding(
  companyId: string,
  payload: { name?: string; logo_url?: string | null }
) {
  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.logo_url !== undefined) updates.logo_url = payload.logo_url;
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase.from("companies").update(updates as any).eq("id", companyId);
  if (error) {
    if (payload.logo_url !== undefined && isMissingLogoColumnError(error.message)) {
      throw new Error(
        "logo_url column is missing. Run the tenant branding migration (20260520120000_tenant_branding.sql) on Supabase."
      );
    }
    throw error;
  }
}

export async function updateAgencyBranding(
  agencyId: string,
  payload: { name?: string; logo_url?: string | null }
) {
  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.logo_url !== undefined) updates.logo_url = payload.logo_url;
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase.from("agencies").update(updates as any).eq("id", agencyId);
  if (error) {
    if (payload.logo_url !== undefined && isMissingLogoColumnError(error.message)) {
      throw new Error(
        "logo_url column is missing. Run the tenant branding migration (20260520120000_tenant_branding.sql) on Supabase."
      );
    }
    throw error;
  }
}
