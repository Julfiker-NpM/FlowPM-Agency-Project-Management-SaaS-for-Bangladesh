"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { endOfUtcDay, formatRelativeShort, startOfUtcDay, startOfUtcMonth } from "@/lib/dates";
import { firestoreToDate } from "@/lib/firebase/firestore-dates";
import { taskProgressPercent } from "@/lib/task-progress";
import { DashboardClient } from "./dashboard-client";

type TaskRow = { id: string; status: string; dueDate: Date | null; assigneeId: string | null; priority: string };

export default function DashboardPage() {
  const { orgId, firebaseUser } = useFlowAuth();
  const uid = firebaseUser?.uid ?? "";
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<{
    stats: {
      activeProjects: number;
      projectsThisMonth: number;
      tasksDueToday: number;
      highPriorityDueToday: number;
      hoursWeek: number;
      memberCount: number;
    };
    projects: { id: string; name: string; progress: number; clientLabel: string; color: string }[];
    myTasks: { id: string; title: string; projectName: string; dueLabel: string }[];
    activity: { id: string; who: string; action: string; when: string }[];
  } | null>(null);

  useEffect(() => {
    if (!orgId || !uid) return;
    const oid = orgId;
    const userUid = uid;

    let cancelled = false;

    async function run() {
      setLoading(true);
      const db = getFirebaseDb();
      const now = new Date();
      const dayStart = startOfUtcDay(now);
      const dayEnd = endOfUtcDay(now);
      const monthStart = startOfUtcMonth(now);
      const weekStart = new Date(now);
      weekStart.setUTCDate(weekStart.getUTCDate() - 7);

      const projectsSnap = await getDocs(collection(db, "organizations", oid, "projects"));
      const projectDocs = projectsSnap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));

      const allTasks: (TaskRow & { projectId: string; title: string; projectName: string })[] = [];
      const projectRows: {
        id: string;
        name: string;
        color: string;
        clientLabel: string;
        createdAt: Date | null;
        status: string;
        tasks: { status: string }[];
      }[] = [];

      for (const p of projectDocs) {
        const d = p.data;
        const name = (d.name as string) ?? "Untitled";
        const color = (d.color as string) ?? "#534AB7";
        const status = (d.status as string) ?? "active";
        const clientId = d.clientId as string | undefined;
        const clientNameField = d.clientName as string | undefined;
        let clientLabel = clientNameField || "No client";
        if (clientId) {
          const cSnap = await getDoc(doc(db, "organizations", oid, "clients", clientId));
          if (cSnap.exists()) {
            const cn = cSnap.data().name as string | undefined;
            if (cn) clientLabel = cn;
          }
        }

        const tasksSnap = await getDocs(
          collection(db, "organizations", oid, "projects", p.id, "tasks"),
        );
        const tasks = tasksSnap.docs.map((t) => {
          const td = t.data() as Record<string, unknown>;
          return {
            id: t.id,
            status: (td.status as string) ?? "todo",
            dueDate: firestoreToDate(td.dueDate),
            assigneeId: (td.assigneeId as string | null) ?? null,
            priority: (td.priority as string) ?? "medium",
            title: (td.title as string) ?? "",
            projectId: p.id,
            projectName: name,
          };
        });

        allTasks.push(...tasks);
        projectRows.push({
          id: p.id,
          name,
          color,
          clientLabel,
          createdAt: firestoreToDate(d.createdAt),
          status,
          tasks: tasks.map((t) => ({ status: t.status })),
        });
      }

      projectRows.sort((a, b) => {
        const ta = a.createdAt?.getTime() ?? 0;
        const tb = b.createdAt?.getTime() ?? 0;
        return tb - ta;
      });

      const activeProjects = projectRows.filter((p) => p.status === "active").length;
      const projectsThisMonth = projectRows.filter(
        (p) => p.createdAt && p.createdAt >= monthStart,
      ).length;

      const tasksDueToday = allTasks.filter((t) => {
        if (t.status === "done" || !t.dueDate) return false;
        return t.dueDate >= dayStart && t.dueDate <= dayEnd;
      }).length;

      const highPriorityDueToday = allTasks.filter((t) => {
        if (t.status === "done" || !t.dueDate) return false;
        if (!(t.dueDate >= dayStart && t.dueDate <= dayEnd)) return false;
        return t.priority === "high";
      }).length;

      const membersSnap = await getDocs(collection(db, "organizations", oid, "members"));
      const memberCount = membersSnap.size;

      const timeSnap = await getDocs(collection(db, "organizations", oid, "timeEntries"));
      let hoursWeek = 0;
      timeSnap.forEach((e) => {
        const ed = e.data() as Record<string, unknown>;
        const dt = firestoreToDate(ed.date);
        const h = ed.hours as number | undefined;
        if (dt && dt >= weekStart && typeof h === "number") hoursWeek += h;
      });

      const myTasksRaw = allTasks.filter((t) => {
        if (t.assigneeId !== userUid || t.status === "done" || !t.dueDate) return false;
        return t.dueDate >= dayStart && t.dueDate <= dayEnd;
      });

      const commentsSnap = await getDocs(collection(db, "organizations", oid, "taskComments"));
      const comments = commentsSnap.docs
        .map((c) => {
          const cd = c.data() as Record<string, unknown>;
          return {
            id: c.id,
            userName: (cd.userName as string) || "Someone",
            taskTitle: (cd.taskTitle as string) || "a task",
            content: (cd.content as string) || "",
            createdAt: firestoreToDate(cd.createdAt),
          };
        })
        .filter((c) => c.createdAt)
        .sort((a, b) => (b.createdAt!.getTime() ?? 0) - (a.createdAt!.getTime() ?? 0))
        .slice(0, 10);

      const topProjects = projectRows.slice(0, 5).map((p) => ({
        id: p.id,
        name: p.name,
        progress: taskProgressPercent(p.tasks),
        clientLabel: p.clientLabel,
        color: p.color,
      }));

      const myTasks = myTasksRaw.slice(0, 8).map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.projectName,
        dueLabel: "Today",
      }));

      const activity = comments.map((c) => ({
        id: c.id,
        who: c.userName,
        action: `commented on “${c.taskTitle}”`,
        when: formatRelativeShort(c.createdAt!),
      }));

      if (!cancelled) {
        setPayload({
          stats: {
            activeProjects,
            projectsThisMonth,
            tasksDueToday,
            highPriorityDueToday,
            hoursWeek,
            memberCount,
          },
          projects: topProjects,
          myTasks,
          activity,
        });
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [orgId, uid]);

  if (!orgId) return null;

  if (loading || !payload) {
    return (
      <p className="text-sm text-flowpm-muted">Loading dashboard…</p>
    );
  }

  return (
    <DashboardClient
      stats={payload.stats}
      projects={payload.projects}
      myTasks={payload.myTasks}
      activity={payload.activity}
    />
  );
}
