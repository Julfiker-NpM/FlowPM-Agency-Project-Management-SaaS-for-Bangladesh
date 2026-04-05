"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { TeamClient, type TeamMemberRow } from "./team-client";

export default function TeamPage() {
  const { orgId, org, firebaseUser } = useFlowAuth();
  const uid = firebaseUser?.uid ?? "";
  const [members, setMembers] = useState<TeamMemberRow[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    const oid = orgId;
    let cancelled = false;

    async function load() {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, "organizations", oid, "members"));
      const rows: TeamMemberRow[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: (data.name as string) || "",
          email: (data.email as string) || "",
          role: (data.role as string) || "member",
        };
      });
      rows.sort((a, b) => a.email.localeCompare(b.email));
      if (!cancelled) setMembers(rows);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, reloadKey]);

  useEffect(() => {
    function onFocus() {
      setReloadKey((k) => k + 1);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!orgId || !org) return null;
  if (!members) {
    return <p className="text-sm text-flowpm-muted">Loading team…</p>;
  }

  const myRole = members.find((m) => m.id === uid)?.role ?? "";
  const canInvite = myRole === "owner" || myRole === "admin";

  return (
    <TeamClient
      members={members}
      orgId={orgId}
      organizationName={org.name}
      orgPlan={org.plan}
      workspaceOwnerId={org.ownerId}
      currentUserId={uid}
      canInvite={canInvite}
      reloadKey={reloadKey}
      onMembersChanged={() => setReloadKey((k) => k + 1)}
    />
  );
}
