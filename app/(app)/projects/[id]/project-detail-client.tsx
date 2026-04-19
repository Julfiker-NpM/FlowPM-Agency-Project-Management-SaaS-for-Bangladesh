"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { firestoreToDate } from "@/lib/firebase/firestore-dates";
import { PageMotion } from "@/components/flowpm/page-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { canMutateWorkspaceContent, isOrgAdminRole } from "@/lib/flowpm/access";
import { canUseClientPortal } from "@/lib/flowpm/plan-limits";

const STATUS_ORDER = ["todo", "in_progress", "review", "done"] as const;
type TaskStatus = (typeof STATUS_ORDER)[number];

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

const PRIORITIES = ["low", "medium", "high"] as const;

function normalizeStatus(s: string): TaskStatus {
  return STATUS_ORDER.includes(s as TaskStatus) ? (s as TaskStatus) : "todo";
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function randomPortalToken(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  position: number;
  dueDate: Date | null;
  assigneeId: string | null;
  priority: string;
  description: string;
};

type MemberOption = { id: string; name: string; email: string };

type ProjectSnapshot = {
  name: string;
  clientName: string;
  color: string;
  status: string;
  dueDate: Date | null;
  clientPortalToken: string | null;
};

function mapTaskDoc(id: string, data: Record<string, unknown>): TaskRow {
  return {
    id,
    title: String(data.title ?? "").trim() || "Untitled task",
    status: normalizeStatus(String(data.status ?? "todo")),
    position: typeof data.position === "number" ? data.position : 0,
    dueDate: firestoreToDate(data.dueDate),
    assigneeId: (data.assigneeId as string | null) ?? null,
    priority: String(data.priority ?? "medium"),
    description: String(data.description ?? ""),
  };
}

export function ProjectDetailClient(props: {
  orgId: string;
  projectId: string;
  memberRole: string | null;
  orgPlan: string;
}) {
  const { orgId, projectId, memberRole, orgPlan } = props;
  const db = getFirebaseDb();

  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const lastOpenedTaskRef = useRef<string | null>(null);

  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium",
    assigneeId: "",
    due: "",
  });
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [settingsDraft, setSettingsDraft] = useState({
    name: "",
    clientName: "",
    color: "#534AB7",
    status: "active",
    due: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const canEdit = canMutateWorkspaceContent(memberRole);
  const isOrgAdmin = isOrgAdminRole(memberRole);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalMessage, setPortalMessage] = useState<string | null>(null);
  const [portalOrigin, setPortalOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setPortalOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, "organizations", orgId, "members")).then((snap) => {
      if (cancelled) return;
      const rows: MemberOption[] = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        const email = String(x.email ?? "");
        const name = String(x.name ?? "").trim() || email.split("@")[0] || "Member";
        return { id: d.id, name, email };
      });
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [db, orgId]);

  useEffect(() => {
    setLoading(true);
    const pref = doc(db, "organizations", orgId, "projects", projectId);
    const unsubP = onSnapshot(
      pref,
      (snap) => {
        if (!snap.exists()) {
          setMissing(true);
          setProject(null);
          setLoading(false);
          return;
        }
        setMissing(false);
        const d = snap.data() as Record<string, unknown>;
        const due = firestoreToDate(d.dueDate);
        setProject({
          name: String(d.name ?? "Project"),
          clientName: (d.clientName as string) ?? "",
          color: String(d.color ?? "#534AB7"),
          status: String(d.status ?? "active"),
          dueDate: due,
          clientPortalToken: (d.clientPortalToken as string) || null,
        });
        setSettingsDraft((prev) => ({
          ...prev,
          name: String(d.name ?? "Project"),
          clientName: String(d.clientName ?? ""),
          color: String(d.color ?? "#534AB7"),
          status: String(d.status ?? "active"),
          due: due ? toInputDate(due) : "",
        }));
        setLoading(false);
      },
      () => {
        setMissing(true);
        setProject(null);
        setLoading(false);
      },
    );

    const tref = collection(db, "organizations", orgId, "projects", projectId, "tasks");
    const unsubT = onSnapshot(
      tref,
      (snap) => {
        const rows = snap.docs.map((x) => mapTaskDoc(x.id, x.data() as Record<string, unknown>));
        rows.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
        setTasks(rows);
      },
      () => setTasks([]),
    );

    return () => {
      unsubP();
      unsubT();
    };
  }, [db, orgId, projectId]);

  const columns = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      id: status,
      title: STATUS_LABELS[status],
      tasks: tasks.filter((t) => t.status === status),
    }));
  }, [tasks]);

  useEffect(() => {
    if (!selectedTaskId) {
      lastOpenedTaskRef.current = null;
      return;
    }
    if (tasks.length === 0) return;
    const t = tasks.find((x) => x.id === selectedTaskId);
    if (!t) {
      setSelectedTaskId(null);
      setTaskSheetOpen(false);
      return;
    }
    if (lastOpenedTaskRef.current !== selectedTaskId) {
      lastOpenedTaskRef.current = selectedTaskId;
      setTaskDraft({
        title: t.title,
        description: t.description,
        status: t.status,
        priority: PRIORITIES.includes(t.priority as (typeof PRIORITIES)[number]) ? t.priority : "medium",
        assigneeId: t.assigneeId ?? "",
        due: t.dueDate ? toInputDate(t.dueDate) : "",
      });
      setTaskError(null);
    }
  }, [selectedTaskId, tasks]);

  const openTask = useCallback((id: string) => {
    setTaskError(null);
    setSelectedTaskId(id);
    setTaskSheetOpen(true);
  }, []);

  const nextPositionInStatus = useCallback(
    (status: TaskStatus, excludeTaskId?: string) => {
      const inCol = tasks.filter((t) => t.status === status && t.id !== excludeTaskId);
      const max = inCol.reduce((m, t) => Math.max(m, t.position), -1);
      return max + 1;
    },
    [tasks],
  );

  async function addTask(status: TaskStatus) {
    if (!canEdit) return;
    setTaskError(null);
    try {
      const colRef = collection(db, "organizations", orgId, "projects", projectId, "tasks");
      const ref = await addDoc(colRef, {
        title: "New task",
        status,
        position: nextPositionInStatus(status),
        priority: "medium",
        assigneeId: null,
        description: "",
        createdAt: serverTimestamp(),
      });
      setSelectedTaskId(ref.id);
      setTaskSheetOpen(true);
    } catch {
      setTaskError("Could not add task.");
    }
  }

  async function saveTask() {
    if (!canEdit || !selectedTaskId) return;
    const st = tasks.find((t) => t.id === selectedTaskId);
    if (!st) return;
    setTaskError(null);
    setTaskSaving(true);
    try {
      const ref = doc(db, "organizations", orgId, "projects", projectId, "tasks", selectedTaskId);
      const payload: Record<string, unknown> = {
        title: taskDraft.title.trim() || "Untitled task",
        description: taskDraft.description.trim(),
        status: taskDraft.status,
        priority: taskDraft.priority,
        assigneeId: taskDraft.assigneeId || null,
      };
      if (taskDraft.due) {
        const d = new Date(taskDraft.due);
        if (!Number.isNaN(d.getTime())) payload.dueDate = Timestamp.fromDate(d);
      } else {
        payload.dueDate = deleteField();
      }
      if (st.status !== taskDraft.status) {
        payload.position = nextPositionInStatus(taskDraft.status, selectedTaskId);
      }
      await updateDoc(ref, payload);
      setTaskSheetOpen(false);
      setSelectedTaskId(null);
    } catch {
      setTaskError("Could not save task.");
    } finally {
      setTaskSaving(false);
    }
  }

  async function removeTask() {
    if (!canEdit || !selectedTaskId) return;
    setTaskError(null);
    setTaskSaving(true);
    try {
      await deleteDoc(doc(db, "organizations", orgId, "projects", projectId, "tasks", selectedTaskId));
      setTaskSheetOpen(false);
      setSelectedTaskId(null);
    } catch {
      setTaskError("Could not delete task.");
    } finally {
      setTaskSaving(false);
    }
  }

  async function saveProjectSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSettingsError(null);
    setSettingsSaving(true);
    try {
      const ref = doc(db, "organizations", orgId, "projects", projectId);
      const payload: Record<string, unknown> = {
        name: settingsDraft.name.trim() || "Untitled",
        clientName: settingsDraft.clientName.trim() || null,
        color: settingsDraft.color.trim() || "#534AB7",
        status: settingsDraft.status.trim() || "active",
      };
      if (settingsDraft.due) {
        const d = new Date(settingsDraft.due);
        if (!Number.isNaN(d.getTime())) payload.dueDate = Timestamp.fromDate(d);
      } else {
        payload.dueDate = deleteField();
      }
      await updateDoc(ref, payload);
    } catch {
      setSettingsError("Could not update project.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function pushPortalSnapshot(token: string) {
    if (!project) return;
    const taskCounts: Record<string, number> = {};
    for (const s of STATUS_ORDER) taskCounts[s] = tasks.filter((t) => t.status === s).length;
    const total = tasks.length;
    const completionPercent = total ? Math.round((taskCounts.done / total) * 100) : 0;
    await setDoc(
      doc(db, "portalLinks", token),
      {
        orgId,
        projectId,
        projectName: project.name,
        clientLabel: project.clientName || "Client",
        projectStatus: project.status,
        taskCounts,
        completionPercent,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async function createClientPortalLink() {
    if (!project || !isOrgAdmin) return;
    setPortalMessage(null);
    setPortalBusy(true);
    try {
      const token = randomPortalToken();
      await pushPortalSnapshot(token);
      await updateDoc(doc(db, "organizations", orgId, "projects", projectId), {
        clientPortalToken: token,
      });
      setPortalMessage("Share link created. Copy it below.");
    } catch {
      setPortalMessage("Could not create portal link. Try again as an admin.");
    } finally {
      setPortalBusy(false);
    }
  }

  async function refreshClientPortalSnapshot() {
    const token = project?.clientPortalToken;
    if (!token || !isOrgAdmin) return;
    setPortalMessage(null);
    setPortalBusy(true);
    try {
      await pushPortalSnapshot(token);
      setPortalMessage("Portal snapshot updated.");
    } catch {
      setPortalMessage("Could not refresh portal.");
    } finally {
      setPortalBusy(false);
    }
  }

  async function revokeClientPortalLink() {
    const token = project?.clientPortalToken;
    if (!token || !isOrgAdmin) return;
    setPortalMessage(null);
    setPortalBusy(true);
    try {
      await deleteDoc(doc(db, "portalLinks", token));
      await updateDoc(doc(db, "organizations", orgId, "projects", projectId), {
        clientPortalToken: deleteField(),
      });
      setPortalMessage("Client portal link revoked.");
    } catch {
      setPortalMessage("Could not revoke portal.");
    } finally {
      setPortalBusy(false);
    }
  }

  const timelineTasks = useMemo(() => {
    return [...tasks]
      .filter((t) => t.dueDate && t.status !== "done")
      .sort((a, b) => (a.dueDate!.getTime() ?? 0) - (b.dueDate!.getTime() ?? 0));
  }, [tasks]);

  function memberLabel(id: string | null) {
    if (!id) return "—";
    const m = members.find((x) => x.id === id);
    return m?.name ?? id.slice(0, 6);
  }

  if (loading && !project && !missing) {
    return (
      <PageMotion>
        <div className="w-full min-w-0 max-w-full space-y-6">
          <div className="rounded-xl border border-flowpm-border bg-flowpm-surface p-5 shadow-card">
            <div className="h-3 w-24 animate-pulse rounded bg-flowpm-border" />
            <div className="mt-4 h-8 max-w-md animate-pulse rounded-lg bg-flowpm-border" />
            <div className="mt-3 h-4 w-48 animate-pulse rounded bg-flowpm-border" />
          </div>
          <div className="flex h-11 animate-pulse gap-1 rounded-lg bg-flowpm-border/60 p-1" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="min-h-[180px] rounded-xl border border-flowpm-border bg-flowpm-surface p-3 shadow-card"
              >
                <div className="mb-3 h-4 w-20 animate-pulse rounded bg-flowpm-border" />
                <div className="h-16 animate-pulse rounded-lg bg-flowpm-canvas" />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-flowpm-muted">Loading project…</p>
        </div>
      </PageMotion>
    );
  }
  if (missing) {
    return (
      <PageMotion>
        <div className="rounded-xl border border-flowpm-border bg-flowpm-surface p-8 text-center shadow-card">
          <p className="text-sm font-medium text-flowpm-body">We couldn&apos;t find this project.</p>
          <p className="mt-2 text-xs text-flowpm-muted">It may have been removed or you don&apos;t have access.</p>
          <Link
            href="/projects"
            className="mt-6 inline-flex text-sm font-medium text-flowpm-primary hover:underline"
          >
            ← Back to all projects
          </Link>
        </div>
      </PageMotion>
    );
  }

  if (!project) return null;

  const dueStr = project.dueDate
    ? project.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <PageMotion>
      <div className="w-full min-w-0 max-w-full">
      {taskError && !taskSheetOpen ? (
        <p className="mb-3 text-xs text-flowpm-danger">{taskError}</p>
      ) : null}

      <div className="mb-6 rounded-xl border border-flowpm-border bg-flowpm-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div
              className="hidden h-14 w-1.5 shrink-0 rounded-full sm:block"
              style={{ backgroundColor: project.color }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <Link href="/projects" className="text-xs font-medium text-flowpm-primary hover:underline">
                ← All projects
              </Link>
              <h1 className="mt-2 font-heading text-xl font-semibold tracking-tight text-flowpm-dark sm:text-2xl">
                {project.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-flowpm-muted">
                {project.clientName ? (
                  <span>{project.clientName}</span>
                ) : (
                  <span className="italic opacity-80">No client label</span>
                )}
                <span className="text-flowpm-border" aria-hidden>
                  ·
                </span>
                <span className="font-mono text-xs text-flowpm-muted">#{projectId.slice(0, 8)}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            <Badge
              variant="secondary"
              className="w-fit capitalize bg-flowpm-canvas text-flowpm-body dark:bg-white/10"
            >
              {project.status}
            </Badge>
            {dueStr ? (
              <p className="text-xs text-flowpm-muted">
                Due <span className="font-medium text-flowpm-body">{dueStr}</span>
              </p>
            ) : (
              <p className="text-xs text-flowpm-muted">No due date</p>
            )}
          </div>
        </div>
      </div>

      {!canEdit ? (
        <div className="mb-4 rounded-lg border border-flowpm-border bg-flowpm-canvas/60 px-4 py-3 text-sm text-flowpm-body dark:bg-white/[0.06]">
          You have <span className="font-medium">view-only</span> access. Tasks and project settings cannot be changed.
        </div>
      ) : null}

      <Tabs key={projectId} defaultValue="board" className="w-full">
        <TabsList className="mb-4 flex h-auto w-full min-w-0 flex-nowrap gap-1 overflow-x-auto overflow-y-hidden bg-flowpm-surface p-1 [-webkit-overflow-scrolling:touch] md:mb-6 md:flex-wrap md:overflow-x-visible md:overflow-y-visible">
          <TabsTrigger
            value="board"
            className="min-h-9 shrink-0 whitespace-nowrap px-3 md:min-w-0 md:shrink md:basis-[calc(50%-0.125rem)] md:flex-1 lg:basis-0"
          >
            Board
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className="min-h-9 shrink-0 whitespace-nowrap px-3 md:min-w-0 md:shrink md:basis-[calc(50%-0.125rem)] md:flex-1 lg:basis-0"
          >
            List
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="min-h-9 shrink-0 whitespace-nowrap px-3 md:min-w-0 md:shrink md:basis-[calc(50%-0.125rem)] md:flex-1 lg:basis-0"
          >
            Timeline
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="min-h-9 shrink-0 whitespace-nowrap px-3 md:min-w-0 md:shrink md:basis-[calc(50%-0.125rem)] md:flex-1 lg:basis-0"
          >
            Files
          </TabsTrigger>
          {canEdit ? (
            <TabsTrigger
              value="settings"
              className="min-h-9 shrink-0 whitespace-nowrap px-3 md:min-w-0 md:basis-full md:shrink md:flex-1 lg:basis-0"
            >
              Settings
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="board" className="mt-0 min-h-0 w-full min-w-0">
          {tasks.length === 0 ? (
            <p className="mb-4 rounded-lg border border-dashed border-flowpm-border bg-flowpm-canvas/50 px-4 py-3 text-sm text-flowpm-muted dark:bg-white/[0.04]">
              {canEdit ? (
                <>
                  No tasks yet — use <span className="font-medium text-flowpm-body">+ Add task</span> under any column.
                  Columns are Todo, In progress, Review, and Done.
                </>
              ) : (
                <>No tasks in this project yet.</>
              )}
            </p>
          ) : null}
          <div
            className={cn(
              "w-full min-w-0 overflow-x-auto overflow-y-visible pb-2 [-webkit-overflow-scrolling:touch]",
            )}
          >
            <div
              className={cn(
                "flex w-full min-w-0 flex-col gap-4",
                "md:flex-row md:flex-nowrap md:w-max md:max-w-none md:gap-4",
              )}
            >
            {columns.map((col) => (
              <div
                key={col.id}
                className={cn(
                  "flex min-h-[140px] w-full shrink-0 flex-col rounded-xl border border-flowpm-border bg-flowpm-surface p-3 shadow-card",
                  "md:w-[280px] md:min-w-[260px] md:max-w-[280px]",
                )}
              >
                <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
                  <h3 className="min-w-0 truncate font-heading text-sm font-semibold text-flowpm-dark">
                    {col.title}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {col.tasks.length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {col.tasks.length === 0 ? (
                    <p className="text-xs text-flowpm-muted">No tasks</p>
                  ) : (
                    col.tasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openTask(t.id)}
                        className="min-w-0 rounded-lg border border-flowpm-border bg-flowpm-canvas/40 p-3 text-left text-sm text-flowpm-body transition-transform duration-100 hover:border-flowpm-primary/40 hover:bg-flowpm-canvas active:scale-[0.99]"
                      >
                        <span className="block break-words font-medium">{t.title}</span>
                        {t.dueDate ? (
                          <p className="mt-1 text-[10px] text-flowpm-muted">
                            Due {t.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </p>
                        ) : null}
                      </button>
                    ))
                  )}
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 w-full border-dashed text-xs"
                      onClick={() => void addTask(col.id)}
                    >
                      + Add task
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-0 w-full min-w-0">
          <Card className="border-flowpm-border overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-flowpm-border bg-flowpm-canvas/50 text-left text-xs text-flowpm-muted">
                      <th className="px-4 py-3 font-medium">Task</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Priority</th>
                      <th className="px-4 py-3 font-medium">Assignee</th>
                      <th className="px-4 py-3 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-flowpm-muted">
                          {canEdit
                            ? "No tasks yet. Use the Board tab to add some."
                            : "No tasks in this project yet."}
                        </td>
                      </tr>
                    ) : (
                      tasks.map((t) => (
                        <tr key={t.id} className="border-b border-flowpm-border last:border-0">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openTask(t.id)}
                              className="text-left font-medium text-flowpm-body hover:text-flowpm-primary hover:underline"
                            >
                              {t.title}
                            </button>
                          </td>
                          <td className="px-4 py-3 capitalize text-flowpm-muted">
                            {STATUS_LABELS[t.status]}
                          </td>
                          <td className="px-4 py-3 capitalize text-flowpm-muted">{t.priority}</td>
                          <td className="px-4 py-3 text-flowpm-muted">{memberLabel(t.assigneeId)}</td>
                          <td className="px-4 py-3 text-flowpm-muted">
                            {t.dueDate
                              ? t.dueDate.toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 w-full min-w-0">
          <Card className="border-flowpm-border">
            <CardContent className="space-y-3 p-6">
              {timelineTasks.length === 0 ? (
                <p className="text-sm text-flowpm-muted">
                  No upcoming due dates. Add due dates to tasks in the task panel.
                </p>
              ) : (
                timelineTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openTask(t.id)}
                    className="flex w-full items-center justify-between gap-4 rounded-lg border border-flowpm-border px-4 py-3 text-left transition-colors hover:bg-flowpm-canvas"
                  >
                    <span className="font-medium text-flowpm-body">{t.title}</span>
                    <span className="shrink-0 text-xs text-flowpm-muted">
                      {t.dueDate?.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-0 w-full min-w-0">
          <Card className="border-flowpm-border">
            <CardContent className="p-6 text-sm text-flowpm-muted">
              File uploads are not enabled in this build. Use task descriptions for notes and links.
            </CardContent>
          </Card>
        </TabsContent>

        {canEdit ? (
        <TabsContent value="settings" className="mt-0 w-full min-w-0">
          <Card className="border-flowpm-border">
            <CardContent className="p-6">
              <form onSubmit={(e) => void saveProjectSettings(e)} className="mx-auto max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="p-name">Project name</Label>
                  <Input
                    id="p-name"
                    value={settingsDraft.name}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, name: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-client">Client label</Label>
                  <Input
                    id="p-client"
                    value={settingsDraft.clientName}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, clientName: e.target.value }))}
                    className="h-10"
                    placeholder="Company or client name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-color">Color</Label>
                    <Input
                      id="p-color"
                      type="color"
                      value={settingsDraft.color}
                      onChange={(e) => setSettingsDraft((s) => ({ ...s, color: e.target.value }))}
                      className="h-10 w-full cursor-pointer px-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-status">Project status</Label>
                    <select
                      id="p-status"
                      value={settingsDraft.status}
                      onChange={(e) => setSettingsDraft((s) => ({ ...s, status: e.target.value }))}
                      className={cn(
                        "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground",
                        "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        "dark:bg-input/30",
                      )}
                    >
                      <option value="active">Active</option>
                      <option value="review">Review</option>
                      <option value="hold">On hold</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-due">Project due date</Label>
                  <Input
                    id="p-due"
                    type="date"
                    value={settingsDraft.due}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, due: e.target.value }))}
                    className="h-10"
                  />
                </div>
                {settingsError ? <p className="text-xs text-flowpm-danger">{settingsError}</p> : null}
                <Button
                  type="submit"
                  disabled={settingsSaving}
                  className="bg-flowpm-primary hover:bg-flowpm-primary-hover"
                >
                  {settingsSaving ? "Saving…" : "Save project"}
                </Button>
              </form>
              {isOrgAdmin ? (
                <div className="mx-auto mt-10 max-w-md border-t border-flowpm-border pt-8">
                  <h3 className="font-heading text-sm font-semibold text-flowpm-dark">Client portal</h3>
                  {canUseClientPortal(orgPlan) ? (
                    <>
                      <p className="mt-1 text-xs text-flowpm-muted">
                        Read-only progress for clients. The link shows column counts and completion (no sign-in).
                      </p>
                      {portalMessage ? <p className="mt-2 text-xs text-flowpm-body">{portalMessage}</p> : null}
                      {project?.clientPortalToken ? (
                        <div className="mt-3 space-y-2">
                          <Label className="text-xs">Share link</Label>
                          <Input
                            readOnly
                            className="h-9 font-mono text-[11px]"
                            value={
                              portalOrigin
                                ? `${portalOrigin}/portal/${project.clientPortalToken}`
                                : `/portal/${project.clientPortalToken}`
                            }
                            onFocus={(e) => e.target.select()}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={portalBusy}
                              onClick={() => void refreshClientPortalSnapshot()}
                            >
                              Refresh snapshot
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={portalBusy}
                              onClick={() => void revokeClientPortalLink()}
                            >
                              Revoke link
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          className="mt-3 bg-flowpm-primary hover:bg-flowpm-primary-hover"
                          disabled={portalBusy}
                          onClick={() => void createClientPortalLink()}
                        >
                          Create share link
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-flowpm-muted">
                      Client portal links are on <strong className="text-flowpm-body">Pro</strong> and{" "}
                      <strong className="text-flowpm-body">Ultra</strong>.{" "}
                      <Link href="/settings" className="font-medium text-flowpm-primary hover:underline">
                        Upgrade in Settings
                      </Link>
                      .
                    </p>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        ) : null}
      </Tabs>

      <Sheet
        open={taskSheetOpen}
        onOpenChange={(open) => {
          setTaskSheetOpen(open);
          if (!open) setSelectedTaskId(null);
        }}
      >
        <SheetContent side="right" className="w-full border-flowpm-border sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{canEdit ? "Edit task" : "Task details"}</SheetTitle>
            <SheetDescription>
              {canEdit
                ? "Changes save to your workspace for everyone."
                : "You can view this task; editing requires member access."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="space-y-2">
              <Label htmlFor="t-title">Title</Label>
              <Input
                id="t-title"
                value={taskDraft.title}
                onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                className="h-10"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">Description</Label>
              <textarea
                id="t-desc"
                value={taskDraft.description}
                onChange={(e) => setTaskDraft((d) => ({ ...d, description: e.target.value }))}
                rows={4}
                disabled={!canEdit}
                className={cn(
                  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm",
                  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "dark:bg-input/30",
                )}
                placeholder="Details, links, acceptance criteria…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-status">Column</Label>
                <select
                  id="t-status"
                  value={taskDraft.status}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setTaskDraft((d) => ({ ...d, status: normalizeStatus(e.target.value) }))
                  }
                  className={cn(
                    "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground",
                    "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30",
                  )}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-priority">Priority</Label>
                <select
                  id="t-priority"
                  value={taskDraft.priority}
                  disabled={!canEdit}
                  onChange={(e) => setTaskDraft((d) => ({ ...d, priority: e.target.value }))}
                  className={cn(
                    "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground",
                    "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30",
                  )}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-assign">Assignee</Label>
              <select
                id="t-assign"
                value={taskDraft.assigneeId}
                disabled={!canEdit}
                onChange={(e) => setTaskDraft((d) => ({ ...d, assigneeId: e.target.value }))}
                className={cn(
                  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground",
                  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "dark:bg-input/30",
                )}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-due">Due date</Label>
              <Input
                id="t-due"
                type="date"
                value={taskDraft.due}
                onChange={(e) => setTaskDraft((d) => ({ ...d, due: e.target.value }))}
                className="h-10"
                disabled={!canEdit}
              />
            </div>
            {taskError ? <p className="text-xs text-flowpm-danger">{taskError}</p> : null}
          </div>
          <SheetFooter className="flex-col gap-2 sm:flex-col">
            {canEdit ? (
              <>
                <div className="flex w-full gap-2">
                  <Button
                    type="button"
                    className="flex-1 bg-flowpm-primary hover:bg-flowpm-primary-hover"
                    disabled={taskSaving}
                    onClick={() => void saveTask()}
                  >
                    {taskSaving ? "Saving…" : "Save task"}
                  </Button>
                  <Button type="button" variant="outline" disabled={taskSaving} onClick={() => setTaskSheetOpen(false)}>
                    Cancel
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={taskSaving}
                  onClick={() => void removeTask()}
                >
                  Delete task
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => setTaskSheetOpen(false)}>
                Close
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      </div>
    </PageMotion>
  );
}
