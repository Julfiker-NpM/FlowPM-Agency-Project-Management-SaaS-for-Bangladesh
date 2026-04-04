"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { firestoreToDate } from "@/lib/firebase/firestore-dates";
import { taskProgressPercent } from "@/lib/task-progress";
import { ProjectsListClient, type ProjectListItem } from "./projects-list-client";

type ProjectRow = ProjectListItem & { createdMs: number };

export default function ProjectsPage() {
  const { orgId } = useFlowAuth();
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const oid = orgId;
    let cancelled = false;

    async function load() {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, "organizations", oid, "projects"));
      const rows: ProjectRow[] = [];

      for (const docSnap of snap.docs) {
        const d = docSnap.data() as Record<string, unknown>;
        const tasksSnap = await getDocs(
          collection(db, "organizations", oid, "projects", docSnap.id, "tasks"),
        );
        const taskStatuses = tasksSnap.docs.map((t) => ({
          status: ((t.data() as Record<string, unknown>).status as string) ?? "todo",
        }));
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
        const due = firestoreToDate(d.dueDate);
        const createdAt = firestoreToDate(d.createdAt);
        rows.push({
          id: docSnap.id,
          name: (d.name as string) ?? "Untitled",
          clientLabel,
          status: (d.status as string) ?? "active",
          progress: taskProgressPercent(taskStatuses),
          dueLabel: due
            ? due.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : "—",
          color: (d.color as string) ?? "#534AB7",
          createdMs: createdAt?.getTime() ?? 0,
        });
      }

      rows.sort((a, b) => b.createdMs - a.createdMs);
      const cleaned: ProjectListItem[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        clientLabel: r.clientLabel,
        status: r.status,
        progress: r.progress,
        dueLabel: r.dueLabel,
        color: r.color,
      }));
      if (!cancelled) setProjects(cleaned);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (!orgId) return null;
  if (!projects) {
    return <p className="text-sm text-flowpm-muted">Loading projects…</p>;
  }

  return <ProjectsListClient projects={projects} />;
}
