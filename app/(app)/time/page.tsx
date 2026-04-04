"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { firestoreToDate } from "@/lib/firebase/firestore-dates";
import { endOfUtcDay, startOfUtcDay } from "@/lib/dates";
import { TimeClient, type TimeEntryRow } from "./time-client";

export default function TimePage() {
  const { orgId, firebaseUser } = useFlowAuth();
  const uid = firebaseUser?.uid ?? "";
  const [payload, setPayload] = useState<{ todayEntries: TimeEntryRow[]; weekHours: number } | null>(
    null,
  );

  useEffect(() => {
    if (!orgId || !uid) return;
    const oid = orgId;
    const userUid = uid;
    let cancelled = false;

    async function load() {
      const db = getFirebaseDb();
      const now = new Date();
      const dayStart = startOfUtcDay(now);
      const dayEnd = endOfUtcDay(now);
      const weekStart = new Date(now);
      weekStart.setUTCDate(weekStart.getUTCDate() - 7);

      const snap = await getDocs(collection(db, "organizations", oid, "timeEntries"));
      const todayEntries: TimeEntryRow[] = [];
      let weekHours = 0;

      for (const docSnap of snap.docs) {
        const d = docSnap.data() as Record<string, unknown>;
        const userId = d.userId as string;
        const hours = d.hours as number;
        const dt = firestoreToDate(d.date);
        const projectId = d.projectId as string | undefined;

        if (dt && typeof hours === "number" && dt >= weekStart) {
          weekHours += hours;
        }

        if (userId !== userUid || !dt) continue;
        if (dt < dayStart || dt > dayEnd) continue;

        let projectName = "Project";
        if (projectId) {
          const pSnap = await getDoc(doc(db, "organizations", oid, "projects", projectId));
          if (pSnap.exists()) {
            const n = (pSnap.data() as Record<string, unknown>).name as string | undefined;
            if (n) projectName = n;
          }
        }

        todayEntries.push({
          id: docSnap.id,
          hours,
          description: (d.description as string) || null,
          projectName,
          dateLabel: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        });
      }

      if (!cancelled) {
        setPayload({ todayEntries, weekHours });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, uid]);

  if (!orgId) return null;
  if (!payload) {
    return <p className="text-sm text-flowpm-muted">Loading…</p>;
  }

  return <TimeClient todayEntries={payload.todayEntries} weekHours={payload.weekHours} />;
}
