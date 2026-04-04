"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { ProjectDetailClient, type BoardColumn } from "./project-detail-client";

const STATUS_ORDER = ["todo", "in_progress", "review", "done"] as const;
const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = typeof params.id === "string" ? params.id : "";
  const { orgId } = useFlowAuth();
  const [state, setState] = useState<{ name: string; columns: BoardColumn[] } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!orgId || !projectId) return;
    const oid = orgId;
    let cancelled = false;

    async function load() {
      const db = getFirebaseDb();
      const ref = doc(db, "organizations", oid, "projects", projectId);
      const pSnap = await getDoc(ref);
      if (!pSnap.exists()) {
        if (!cancelled) setMissing(true);
        return;
      }
      const name = ((pSnap.data() as Record<string, unknown>).name as string) ?? "Project";
      const tasksSnap = await getDocs(collection(db, "organizations", oid, "projects", projectId, "tasks"));
      const tasks = tasksSnap.docs.map((t) => ({
        id: t.id,
        title: ((t.data() as Record<string, unknown>).title as string) ?? "",
        status: ((t.data() as Record<string, unknown>).status as string) ?? "todo",
        position: ((t.data() as Record<string, unknown>).position as number) ?? 0,
      }));
      tasks.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

      const columns: BoardColumn[] = STATUS_ORDER.map((status) => ({
        id: status,
        title: STATUS_LABELS[status],
        tasks: tasks.filter((t) => t.status === status).map((t) => ({ id: t.id, title: t.title })),
      }));

      if (!cancelled) {
        setState({ name, columns });
        setMissing(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, projectId]);

  if (!orgId || !projectId) return null;
  if (missing) {
    return <p className="text-sm text-flowpm-muted">Project not found.</p>;
  }
  if (!state) {
    return <p className="text-sm text-flowpm-muted">Loading…</p>;
  }

  return <ProjectDetailClient projectId={projectId} name={state.name} columns={state.columns} />;
}
