"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { PageMotion } from "@/components/flowpm/page-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { canUseTimeTracking } from "@/lib/flowpm/plan-limits";
import { firestoreToDate } from "@/lib/firebase/firestore-dates";
import { endOfUtcDay, startOfUtcDay } from "@/lib/dates";
import { TimeClient, type TimeEntryRow, type ProjectOption } from "./time-client";

export default function TimePage() {
  const { orgId, org, firebaseUser } = useFlowAuth();
  const uid = firebaseUser?.uid ?? "";
  const [payload, setPayload] = useState<{
    todayEntries: TimeEntryRow[];
    weekHours: number;
    projects: ProjectOption[];
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!orgId || !uid) return;
    const oid = orgId;
    const userUid = uid;
    let cancelled = false;

    async function run() {
      const db = getFirebaseDb();
      const now = new Date();
      const dayStart = startOfUtcDay(now);
      const dayEnd = endOfUtcDay(now);
      const weekStart = new Date(now);
      weekStart.setUTCDate(weekStart.getUTCDate() - 7);

      const [projSnap, timeSnap] = await Promise.all([
        getDocs(collection(db, "organizations", oid, "projects")),
        getDocs(collection(db, "organizations", oid, "timeEntries")),
      ]);

      const projects: ProjectOption[] = projSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return { id: d.id, name: (data.name as string) || "Untitled" };
      });
      projects.sort((a, b) => a.name.localeCompare(b.name));

      const todayEntries: TimeEntryRow[] = [];
      let weekHours = 0;

      for (const docSnap of timeSnap.docs) {
        const d = docSnap.data() as Record<string, unknown>;
        const entryUserId = d.userId as string;
        const hours = d.hours as number;
        const dt = firestoreToDate(d.date);
        const projectId = d.projectId as string | undefined;

        if (entryUserId === userUid && dt && typeof hours === "number" && dt >= weekStart) {
          weekHours += hours;
        }

        if (entryUserId !== userUid || !dt) continue;
        if (dt < dayStart || dt > dayEnd) continue;

        let projectName = "No project";
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
        setPayload({ todayEntries, weekHours, projects });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [orgId, uid, refreshKey]);

  const onSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (!orgId) return null;
  if (!uid) {
    return <p className="text-sm text-flowpm-muted">Loading…</p>;
  }
  if (!payload) {
    return <p className="text-sm text-flowpm-muted">Loading…</p>;
  }

  if (!canUseTimeTracking(org?.plan)) {
    return (
      <PageMotion>
        <Card className="mx-auto max-w-lg border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Time tracking</CardTitle>
            <p className="text-sm text-flowpm-muted">
              Time tracking is included on <strong className="text-flowpm-body">Pro</strong> and{" "}
              <strong className="text-flowpm-body">Ultra</strong>. Starter includes tasks only.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "default" }),
                "inline-flex h-10 items-center justify-center px-4 bg-flowpm-primary hover:bg-flowpm-primary-hover",
              )}
            >
              View plans &amp; upgrade
            </Link>
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }), "inline-flex h-10 items-center px-4")}>
              Back to projects
            </Link>
          </CardContent>
        </Card>
      </PageMotion>
    );
  }

  return (
    <TimeClient
      orgId={orgId}
      userId={uid}
      todayEntries={payload.todayEntries}
      weekHours={payload.weekHours}
      projects={payload.projects}
      onEntrySaved={onSaved}
    />
  );
}
