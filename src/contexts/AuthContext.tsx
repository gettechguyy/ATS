import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  getStoredSession,
  setStoredSession,
  clearStoredSession,
  loginWithEmailPassword,
  createAppUser,
  type SessionUser,
  type SessionCompany,
} from "@/lib/authApi";

export type AppRole = "admin" | "recruiter" | "candidate" | "manager" | "team_lead" | "agency_admin";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  linked_candidate_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  agency_id?: string | null;
  company_id?: string | null;
}

/** App user (from our app_users table + session). Same shape as before so user.id works everywhere. */
export interface AppUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AppUser | null;
  profile: Profile | null;
  role: AppRole | null;
  company: SessionCompany | null;
  /** Out-marketing agency model (Agencies page, agency assignment, agency_admin) is only for the main tenant. */
  isMasterCompany: boolean;
  isAdmin: boolean;
  isRecruiter: boolean;
  isTeamLead: boolean;
  isCandidate: boolean;
  isManager: boolean;
  isAgencyAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Apply a session (e.g. after company registration) without a separate login. */
  establishSession: (session: SessionUser) => void;
  createUser: (
    email: string,
    password: string,
    fullName: string,
    role: string,
    agencyId?: string | null
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sessionToUser(s: SessionUser): AppUser {
  return { id: s.user_id, email: s.email };
}

function sessionToProfile(s: SessionUser): Profile | null {
  const p = s.profile;
  if (!p) return null;
  return {
    id: p.id,
    user_id: p.user_id,
    full_name: p.full_name,
    email: p.email,
    linked_candidate_id: p.linked_candidate_id,
    is_active: p.is_active !== false,
    created_at: p.created_at,
    updated_at: p.updated_at,
    agency_id: p.agency_id ?? null,
    company_id: p.company_id ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [company, setCompany] = useState<SessionCompany | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStoredSession();
    if (session?.user_id) {
      setUser(sessionToUser(session));
      setProfile(sessionToProfile(session));
      setRole((session.role as AppRole) ?? null);
      setCompany(session.company ?? null);
    } else {
      setUser(null);
      setProfile(null);
      setRole(null);
      setCompany(null);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await loginWithEmailPassword(email, password);
    if (error) return { error };
    if (!data) return { error: new Error("Invalid email or password") };
    setStoredSession(data);
    setUser(sessionToUser(data));
    setProfile(sessionToProfile(data));
    setRole((data.role as AppRole) ?? null);
    setCompany(data.company ?? null);
    return { error: null };
  };

  const establishSession = (data: SessionUser) => {
    setStoredSession(data);
    setUser(sessionToUser(data));
    setProfile(sessionToProfile(data));
    setRole((data.role as AppRole) ?? null);
    setCompany(data.company ?? null);
  };

  const createUser = async (
    email: string,
    password: string,
    fullName: string,
    roleParam: string,
    agencyId?: string | null
  ) => {
    if (!user?.id) return { error: new Error("Not authenticated") };
    const { error } = await createAppUser(
      user.id,
      email,
      password,
      fullName,
      roleParam,
      agencyId ?? undefined
    );
    return { error: error ?? null };
  };

  const signOut = async () => {
    clearStoredSession();
    setUser(null);
    setProfile(null);
    setRole(null);
    setCompany(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        company,
        isMasterCompany: company?.slug === "thetechguyy",
        isAdmin: role === "admin",
        isRecruiter: role === "recruiter",
        isTeamLead: role === "team_lead",
        isCandidate: role === "candidate",
        isManager: role === "manager",
        isAgencyAdmin: role === "agency_admin",
        loading,
        signIn,
        establishSession,
        createUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
