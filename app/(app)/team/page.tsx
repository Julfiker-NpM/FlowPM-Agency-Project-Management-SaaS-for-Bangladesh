"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { TeamClient, type TeamMemberRow } from "./team-client";

export default function TeamPage() {
  const { orgId } = useFlowAuth();
  const [members, setMembers] = useState<TeamMemberRow[] | null>(null);

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
  }, [orgId]);

  if (!orgId) return null;
  if (!members) {
    return <p className="text-sm text-flowpm-muted">Loading team…</p>;
  }

  return <TeamClient members={members} />;
}
