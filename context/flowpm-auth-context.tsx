"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";

export type UserProfile = {
  email: string;
  name: string | null;
  currentOrgId: string | null;
};

export type OrgSummary = {
  name: string;
  slug: string;
  plan: string;
  /** Firebase Auth uid of the workspace creator (cannot be removed from members). */
  ownerId: string | null;
};

type FlowAuthState = {
  firebaseUser: User | null;
  profile: UserProfile | null;
  org: OrgSummary | null;
  orgId: string | null;
  /** Role from `organizations/{orgId}/members/{uid}` — owner | admin | member | viewer */
  memberRole: string | null;
  loading: boolean;
  /** True after the first onAuthStateChanged callback finishes (avoids flash / wrong redirects on layout changes). */
  authReady: boolean;
  /** Set when NEXT_PUBLIC_FIREBASE_* are missing (e.g. Vercel env not added / redeploy needed). */
  configMissing: boolean;
  refreshProfile: () => Promise<void>;
};

const FlowAuthContext = createContext<FlowAuthState | null>(null);

async function loadProfileAndOrg(uid: string): Promise<{
  profile: UserProfile | null;
  org: OrgSummary | null;
  orgId: string | null;
  memberRole: string | null;
}> {
  const db = getFirebaseDb();
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) {
    return { profile: null, org: null, orgId: null, memberRole: null };
  }
  const data = userSnap.data();
  const profile: UserProfile = {
    email: (data.email as string) ?? "",
    name: (data.name as string | null) ?? null,
    currentOrgId: (data.currentOrgId as string | null) ?? null,
  };
  const orgId = profile.currentOrgId;
  if (!orgId) {
    return { profile, org: null, orgId: null, memberRole: null };
  }
  const [orgSnap, memSnap] = await Promise.all([
    getDoc(doc(db, "organizations", orgId)),
    getDoc(doc(db, "organizations", orgId, "members", uid)),
  ]);
  if (!orgSnap.exists()) {
    return { profile, org: null, orgId, memberRole: null };
  }
  const o = orgSnap.data();
  const org: OrgSummary = {
    name: (o.name as string) ?? "Workspace",
    slug: (o.slug as string) ?? "",
    plan: (o.plan as string) ?? "free",
    ownerId: typeof o.ownerId === "string" ? o.ownerId : null,
  };
  const memberRole = memSnap.exists() ? String((memSnap.data() as Record<string, unknown>).role ?? "") : null;
  return { profile, org, orgId, memberRole: memberRole || null };
}

export function FlowAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [configMissing, setConfigMissing] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!isFirebaseConfigured()) return;
    const u = getFirebaseAuth().currentUser;
    if (!u) {
      setProfile(null);
      setOrg(null);
      setOrgId(null);
      setMemberRole(null);
      return;
    }
    const next = await loadProfileAndOrg(u.uid);
    setProfile(next.profile);
    setOrg(next.org);
    setOrgId(next.orgId);
    setMemberRole(next.memberRole);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setConfigMissing(true);
      setLoading(false);
      setAuthReady(true);
      return;
    }
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setOrg(null);
        setOrgId(null);
        setMemberRole(null);
        setLoading(false);
        setAuthReady(true);
        return;
      }
      try {
        const next = await loadProfileAndOrg(user.uid);
        setProfile(next.profile);
        setOrg(next.org);
        setOrgId(next.orgId);
        setMemberRole(next.memberRole);
      } finally {
        setLoading(false);
        setAuthReady(true);
      }
    });
  }, []);

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      org,
      orgId,
      memberRole,
      loading,
      authReady,
      configMissing,
      refreshProfile,
    }),
    [firebaseUser, profile, org, orgId, memberRole, loading, authReady, configMissing, refreshProfile],
  );

  return <FlowAuthContext.Provider value={value}>{children}</FlowAuthContext.Provider>;
}

export function useFlowAuth(): FlowAuthState {
  const ctx = useContext(FlowAuthContext);
  if (!ctx) {
    throw new Error("useFlowAuth must be used within FlowAuthProvider");
  }
  return ctx;
}
