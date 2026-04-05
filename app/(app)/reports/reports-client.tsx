"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { PageMotion } from "@/components/flowpm/page-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectHours = { projectId: string; name: string; hours: number };
type ProjectCompletion = { projectId: string; name: string; done: number; total: number; percent: number };
type MemberLoad = { memberId: string; name: string; openTasks: number };

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-flowpm-body">{label}</span>
        <span className="shrink-0 tabular-nums text-flowpm-muted">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-flowpm-canvas">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function ReportsClient({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoursByProject, setHoursByProject] = useState<ProjectHours[]>([]);
  const [completion, setCompletion] = useState<ProjectCompletion[]>([]);
  const [workload, setWorkload] = useState<MemberLoad[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const db = getFirebaseDb();
        const [projSnap, timeSnap, membersSnap] = await Promise.all([
          getDocs(collection(db, "organizations", orgId, "projects")),
          getDocs(collection(db, "organizations", orgId, "timeEntries")),
          getDocs(collection(db, "organizations", orgId, "members")),
        ]);

        const projectNames = new Map<string, string>();
        projSnap.docs.forEach((d) => {
          const n = String((d.data() as Record<string, unknown>).name ?? "Untitled");
          projectNames.set(d.id, n);
        });

        const hoursMap = new Map<string, number>();
        for (const d of timeSnap.docs) {
          const x = d.data() as Record<string, unknown>;
          const h = x.hours as number | undefined;
          const pid = (x.projectId as string | undefined) ?? "";
          if (typeof h !== "number" || h <= 0) continue;
          const key = pid || "_none";
          hoursMap.set(key, (hoursMap.get(key) ?? 0) + h);
        }
        const hoursRows: ProjectHours[] = [];
        for (const [pid, hours] of Array.from(hoursMap.entries())) {
          hoursRows.push({
            projectId: pid,
            name: pid === "_none" ? "No project" : projectNames.get(pid) ?? "Project",
            hours,
          });
        }
        hoursRows.sort((a, b) => b.hours - a.hours);

        const taskSnaps = await Promise.all(
          projSnap.docs.map((p) => getDocs(collection(db, "organizations", orgId, "projects", p.id, "tasks"))),
        );
        const completionRows: ProjectCompletion[] = [];
        const openByAssignee = new Map<string, number>();

        projSnap.docs.forEach((p, i) => {
          const tasks = taskSnaps[i]?.docs ?? [];
          let done = 0;
          for (const t of tasks) {
            const st = String((t.data() as Record<string, unknown>).status ?? "todo");
            if (st === "done") done += 1;
            else {
              const aid = (t.data() as Record<string, unknown>).assigneeId as string | undefined;
              if (aid) openByAssignee.set(aid, (openByAssignee.get(aid) ?? 0) + 1);
            }
          }
          const total = tasks.length;
          completionRows.push({
            projectId: p.id,
            name: projectNames.get(p.id) ?? "Project",
            done,
            total,
            percent: total ? Math.round((done / total) * 100) : 0,
          });
        });
        completionRows.sort((a, b) => b.total - a.total);

        const memberNames = new Map<string, string>();
        membersSnap.docs.forEach((d) => {
          const x = d.data() as Record<string, unknown>;
          const email = String(x.email ?? "");
          const name = String(x.name ?? "").trim() || email.split("@")[0] || "Member";
          memberNames.set(d.id, name);
        });
        const loadRows: MemberLoad[] = membersSnap.docs.map((d) => ({
          memberId: d.id,
          name: memberNames.get(d.id) ?? d.id,
          openTasks: openByAssignee.get(d.id) ?? 0,
        }));
        loadRows.sort((a, b) => b.openTasks - a.openTasks);

        if (!cancelled) {
          setHoursByProject(hoursRows);
          setCompletion(completionRows);
          setWorkload(loadRows);
        }
      } catch {
        if (!cancelled) setError("Could not load reporting data. Check permissions and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const maxHours = useMemo(() => hoursByProject.reduce((m, r) => Math.max(m, r.hours), 0), [hoursByProject]);
  const maxOpen = useMemo(() => workload.reduce((m, r) => Math.max(m, r.openTasks), 0), [workload]);

  if (loading) {
    return (
      <PageMotion>
        <p className="text-sm text-flowpm-muted">Loading reports…</p>
      </PageMotion>
    );
  }

  if (error) {
    return (
      <PageMotion>
        <p className="text-sm text-flowpm-danger">{error}</p>
      </PageMotion>
    );
  }

  return (
    <PageMotion>
      <div className="mb-6">
        <h2 className="font-heading text-xl font-semibold text-flowpm-dark">Reports</h2>
        <p className="mt-1 text-sm text-flowpm-muted">
          Hours by project, task completion, and open workload per teammate (workspace-wide).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-base">Hours by project</CardTitle>
            <p className="text-xs text-flowpm-muted">All logged time in this workspace</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {hoursByProject.length === 0 ? (
              <p className="text-sm text-flowpm-muted">No time entries yet.</p>
            ) : (
              hoursByProject.map((r) => (
                <BarRow key={r.projectId || "none"} label={r.name} value={r.hours} max={maxHours} color="#534ab7" />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-base">Task completion by project</CardTitle>
            <p className="text-xs text-flowpm-muted">Done vs total tasks</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {completion.length === 0 ? (
              <p className="text-sm text-flowpm-muted">No projects.</p>
            ) : (
              completion.map((r) => (
                <BarRow
                  key={r.projectId}
                  label={r.name}
                  value={r.percent}
                  max={100}
                  color="#0f6e56"
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-flowpm-border shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-base">Team workload</CardTitle>
            <p className="text-xs text-flowpm-muted">Open (non-done) tasks assigned to each member</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {workload.every((w) => w.openTasks === 0) ? (
              <p className="text-sm text-flowpm-muted sm:col-span-2">No assigned open tasks right now.</p>
            ) : (
              workload.map((w) => (
                <BarRow
                  key={w.memberId}
                  label={w.name}
                  value={w.openTasks}
                  max={maxOpen || 1}
                  color="#7f77dd"
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageMotion>
  );
}
