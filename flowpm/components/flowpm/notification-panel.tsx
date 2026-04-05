"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  collectionGroup,
  limit,
  onSnapshot,
  query,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import type { FirebaseError } from "firebase/app";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/lib/button-variants";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type InviteNotificationRow = {
  token: string;
  orgId: string;
  organizationName: string;
  role: string;
  href: string;
};

export type TaskAssignRow = {
  id: string;
  orgId: string;
  projectId: string;
  title: string;
  status: string;
  href: string;
};

export type TaskCommentRow = {
  id: string;
  userName: string;
  taskTitle: string;
  preview: string;
  href: string;
};

function orgIdFromInviteDoc(d: QueryDocumentSnapshot): string | null {
  return d.ref.parent?.parent?.id ?? null;
}

function inviteRowFromDoc(d: QueryDocumentSnapshot): InviteNotificationRow | null {
  const orgId = orgIdFromInviteDoc(d);
  if (!orgId) return null;
  const data = d.data() as Record<string, unknown>;
  return {
    token: d.id,
    orgId,
    organizationName: String(data.organizationName ?? "Workspace"),
    role: String(data.role ?? "member"),
    href: `/invite?org=${encodeURIComponent(orgId)}&t=${encodeURIComponent(d.id)}`,
  };
}

function mapInviteDocs(snapshot: QuerySnapshot): InviteNotificationRow[] {
  const rows: InviteNotificationRow[] = [];
  for (const d of snapshot.docs) {
    const row = inviteRowFromDoc(d);
    if (row) rows.push(row);
  }
  return rows;
}

function firestoreListenerMessage(err: unknown, kind: "invites" | "tasks" | "comments" = "comments"): string {
  const e = err as FirebaseError;
  if (e?.code === "permission-denied") {
    if (kind === "invites") {
      return "Deploy rules to the same Firebase project as the app (NEXT_PUBLIC_FIREBASE_PROJECT_ID). Email sign-in must provide an email on the auth token.";
    }
    if (kind === "tasks") {
      return "Could not load assigned tasks — deploy latest rules and ensure you are a member of this workspace.";
    }
    return "Permission denied — deploy latest Firestore rules for this project.";
  }
  if (e?.code === "failed-precondition") {
    return "Missing Firestore index — run firebase deploy --only firestore:indexes against the same Firebase project as NEXT_PUBLIC_FIREBASE_PROJECT_ID.";
  }
  return e?.message ?? "Query failed";
}

function createdAtMs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  return 0;
}

function notifyDesktop(title: string, body: string, tag: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag });
  } catch {
    /* ignore */
  }
}

export function NotificationBell(props: {
  /** Profile or auth email; invite queries prefer Firebase Auth email to match security rules. */
  userEmail: string;
  userId: string;
  orgId: string;
}) {
  const { userEmail, userId, orgId } = props;
  const notifiedInvitePathRef = useRef(new Set<string>());
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      const e = user?.email?.trim().toLowerCase() ?? "";
      setAuthEmail(e.includes("@") ? e : null);
      setAuthHydrated(true);
    });
  }, []);

  const normalizedEmail = useMemo(() => {
    const prop = userEmail.trim().toLowerCase();
    const propOk = prop.includes("@") ? prop : "";
    if (!authHydrated) return propOk;
    return authEmail ?? propOk;
  }, [authHydrated, authEmail, userEmail]);

  const [orgInvites, setOrgInvites] = useState<InviteNotificationRow[]>([]);
  const [cgInvites, setCgInvites] = useState<InviteNotificationRow[]>([]);
  const [orgInviteErr, setOrgInviteErr] = useState<string | null>(null);
  const [cgInviteErr, setCgInviteErr] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskAssignRow[]>([]);
  const [comments, setComments] = useState<TaskCommentRow[]>([]);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const invites = useMemo(() => {
    const m = new Map<string, InviteNotificationRow>();
    for (const r of orgInvites) m.set(`${r.orgId}:${r.token}`, r);
    for (const r of cgInvites) m.set(`${r.orgId}:${r.token}`, r);
    return Array.from(m.values());
  }, [orgInvites, cgInvites]);
  const inviteError = useMemo(() => {
    if (invites.length > 0) return null;
    return orgInviteErr ?? cgInviteErr;
  }, [invites.length, orgInviteErr, cgInviteErr]);
  const [open, setOpen] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  useEffect(() => {
    if (!normalizedEmail?.includes("@")) {
      setOrgInvites([]);
      setOrgInviteErr(null);
      return;
    }
    if (!orgId) {
      setOrgInvites([]);
      setOrgInviteErr(null);
      return;
    }

    const db = getFirebaseDb();
    const q = query(
      collection(db, "organizations", orgId, "invites"),
      where("email", "==", normalizedEmail),
    );
    let first = true;

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setOrgInviteErr(null);
        const rows = mapInviteDocs(snapshot);
        if (!first) {
          for (const ch of snapshot.docChanges()) {
            if (ch.type === "added") {
              const path = ch.doc.ref.path;
              if (notifiedInvitePathRef.current.has(path)) continue;
              notifiedInvitePathRef.current.add(path);
              const row = inviteRowFromDoc(ch.doc);
              if (!row) continue;
              notifyDesktop(
                "Workspace invite",
                `You're invited to ${row.organizationName}.`,
                `flowpm-invite-${row.orgId}-${ch.doc.id}`,
              );
            }
          }
        } else {
          first = false;
        }
        setOrgInvites(rows);
      },
      (listenerErr) => {
        console.error("[FlowPM] org invite notifications query failed", listenerErr);
        setOrgInviteErr(firestoreListenerMessage(listenerErr, "invites"));
        setOrgInvites([]);
      },
    );

    return () => unsub();
  }, [orgId, normalizedEmail]);

  useEffect(() => {
    if (!normalizedEmail?.includes("@")) {
      setCgInvites([]);
      setCgInviteErr(null);
      return;
    }

    const db = getFirebaseDb();
    const q = query(collectionGroup(db, "invites"), where("email", "==", normalizedEmail));
    let first = true;

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setCgInviteErr(null);
        const rows = mapInviteDocs(snapshot);
        if (!first) {
          for (const ch of snapshot.docChanges()) {
            if (ch.type === "added") {
              const path = ch.doc.ref.path;
              if (notifiedInvitePathRef.current.has(path)) continue;
              notifiedInvitePathRef.current.add(path);
              const row = inviteRowFromDoc(ch.doc);
              if (!row) continue;
              notifyDesktop(
                "Workspace invite",
                `You're invited to ${row.organizationName}.`,
                `flowpm-invite-${row.orgId}-${ch.doc.id}`,
              );
            }
          }
        } else {
          first = false;
        }
        setCgInvites(rows);
      },
      (listenerErr) => {
        console.error("[FlowPM] collectionGroup invite notifications query failed", listenerErr);
        setCgInviteErr(firestoreListenerMessage(listenerErr, "invites"));
        setCgInvites([]);
      },
    );

    return () => unsub();
  }, [normalizedEmail]);

  useEffect(() => {
    if (!userId || !orgId) {
      setTasks([]);
      setTasksError(null);
      return;
    }

    const db = getFirebaseDb();
    const projectsCol = collection(db, "organizations", orgId, "projects");
    const taskUnsubs = new Map<string, () => void>();
    const rowsByKey = new Map<string, TaskAssignRow>();
    const seenFirstTaskSnap = new Set<string>();

    const mergeAndSet = () => {
      setTasks(
        Array.from(rowsByKey.values()).sort((a, b) => a.title.localeCompare(b.title)),
      );
    };

    const removeProject = (pid: string) => {
      const u = taskUnsubs.get(pid);
      if (u) {
        u();
        taskUnsubs.delete(pid);
      }
      for (const k of Array.from(rowsByKey.keys())) {
        if (k.startsWith(`${pid}:`)) rowsByKey.delete(k);
      }
      seenFirstTaskSnap.delete(pid);
    };

    const attachProject = (pid: string) => {
      if (taskUnsubs.has(pid)) return;
      const tq = query(
        collection(db, "organizations", orgId, "projects", pid, "tasks"),
        where("assigneeId", "==", userId),
      );
      const unsubTasks = onSnapshot(
        tq,
        (snap) => {
          setTasksError(null);
          for (const k of Array.from(rowsByKey.keys())) {
            if (k.startsWith(`${pid}:`)) rowsByKey.delete(k);
          }
          const firstSnap = !seenFirstTaskSnap.has(pid);
          if (!firstSnap) {
            for (const ch of snap.docChanges()) {
              if (ch.type !== "added") continue;
              const data = ch.doc.data() as Record<string, unknown>;
              if (String(data.status ?? "") === "done") continue;
              if (String(data.assigneeId ?? "") !== userId) continue;
              notifyDesktop(
                "Task assigned",
                `${String(data.title ?? "Task")} — open FlowPM to view.`,
                `flowpm-task-${pid}-${ch.doc.id}`,
              );
            }
          }
          seenFirstTaskSnap.add(pid);

          for (const d of snap.docs) {
            const data = d.data() as Record<string, unknown>;
            if (String(data.assigneeId ?? "") !== userId) continue;
            const status = String(data.status ?? "todo");
            if (status === "done") continue;
            rowsByKey.set(`${pid}:${d.id}`, {
              id: d.id,
              orgId,
              projectId: pid,
              title: String(data.title ?? "Task"),
              status,
              href: `/projects/${pid}`,
            });
          }
          mergeAndSet();
        },
        (listenerErr) => {
          console.error("[FlowPM] assigned tasks notifications query failed", listenerErr);
          setTasksError(firestoreListenerMessage(listenerErr, "tasks"));
        },
      );
      taskUnsubs.set(pid, unsubTasks);
    };

    const unsubProjects = onSnapshot(
      projectsCol,
      (projSnap) => {
        setTasksError(null);
        const ids = new Set(projSnap.docs.map((d) => d.id));
        for (const pid of Array.from(taskUnsubs.keys())) {
          if (!ids.has(pid)) removeProject(pid);
        }
        for (const pid of Array.from(ids)) attachProject(pid);
        mergeAndSet();
      },
      (listenerErr) => {
        console.error("[FlowPM] projects list listener for notifications failed", listenerErr);
        setTasksError(firestoreListenerMessage(listenerErr, "tasks"));
        setTasks([]);
      },
    );

    return () => {
      unsubProjects();
      for (const u of Array.from(taskUnsubs.values())) u();
      taskUnsubs.clear();
      rowsByKey.clear();
    };
  }, [userId, orgId]);

  useEffect(() => {
    if (!userId || !orgId) {
      setComments([]);
      return;
    }

    const db = getFirebaseDb();
    const q = query(collection(db, "organizations", orgId, "taskComments"), limit(50));
    let first = true;

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setCommentsError(null);
        const sorted = [...snapshot.docs].sort(
          (a, b) => createdAtMs(b.data().createdAt) - createdAtMs(a.data().createdAt),
        );
        const rows: TaskCommentRow[] = [];
        for (const d of sorted) {
          const data = d.data() as Record<string, unknown>;
          const authorId = String(data.userId ?? "");
          if (authorId === userId) continue;
          const userName = String(data.userName ?? "Someone");
          const taskTitle = String(data.taskTitle ?? "a task");
          const content = String(data.content ?? "").trim();
          const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content || "…";
          const projectId = data.projectId as string | undefined;
          const href = projectId ? `/projects/${projectId}` : "/dashboard";
          rows.push({ id: d.id, userName, taskTitle, preview, href });
          if (rows.length >= 8) break;
        }
        if (!first) {
          for (const ch of snapshot.docChanges()) {
            if (ch.type !== "added") continue;
            const data = ch.doc.data() as Record<string, unknown>;
            if (String(data.userId ?? "") === userId) continue;
            const taskTitle = String(data.taskTitle ?? "a task");
            const who = String(data.userName ?? "Someone");
            notifyDesktop(
              "Task comment",
              `${who} on “${taskTitle}”`,
              `flowpm-comment-${orgId}-${ch.doc.id}`,
            );
          }
        } else {
          first = false;
        }
        setComments(rows);
      },
      (listenerErr) => {
        console.error("[FlowPM] task comments notifications query failed", listenerErr);
        setCommentsError(firestoreListenerMessage(listenerErr, "comments"));
        setComments([]);
      },
    );

    return () => unsub();
  }, [userId, orgId]);

  const badgeCount = invites.length + tasks.length;

  async function requestDesktopPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const next = await Notification.requestPermission();
    setDesktopPermission(next);
  }

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <p className="bg-flowpm-canvas/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-flowpm-muted">
        {children}
      </p>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "relative size-9 shrink-0 border-flowpm-border bg-flowpm-surface text-flowpm-body hover:bg-flowpm-canvas",
        )}
        aria-label={badgeCount ? `${badgeCount} notifications` : "Notifications"}
      >
        <Bell className="size-4" aria-hidden />
        {badgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.125rem] justify-center">
            <Badge className="h-5 min-w-5 border-0 bg-flowpm-primary px-1 text-[10px] text-white">
              {badgeCount > 9 ? "9+" : badgeCount}
            </Badge>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(calc(100vw-2rem),22rem)] border border-flowpm-border bg-flowpm-surface p-0 shadow-lg"
      >
        <div className="border-b border-flowpm-border px-3 py-2">
          <p className="text-sm font-semibold text-flowpm-dark">Notifications</p>
          <p className="text-xs text-flowpm-muted">Invites, your tasks, and team comments (live)</p>
        </div>

        {inviteError || tasksError || commentsError ? (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {inviteError ? <p className="mb-1">Invites: {inviteError}</p> : null}
            {tasksError ? <p className="mb-1">Assigned tasks: {tasksError}</p> : null}
            {commentsError ? <p>Comments: {commentsError}</p> : null}
          </div>
        ) : null}

        <div className="max-h-[min(70vh,22rem)] overflow-y-auto">
          <SectionTitle>Workspace invites</SectionTitle>
          {invites.length === 0 ? (
            <p className="px-3 py-2 text-xs text-flowpm-muted">No pending invites</p>
          ) : (
            invites.map((row) => (
              <DropdownMenuItem key={`inv-${row.orgId}-${row.token}`} className="cursor-pointer p-0">
                <Link
                  href={row.href}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left no-underline hover:bg-flowpm-canvas"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-sm font-medium text-flowpm-body">{row.organizationName}</span>
                  <span className="text-xs text-flowpm-muted">Role: {row.role} · Tap to accept</span>
                </Link>
              </DropdownMenuItem>
            ))
          )}

          <SectionTitle>Assigned to you</SectionTitle>
          {tasks.length === 0 ? (
            <p className="px-3 py-2 text-xs text-flowpm-muted">No open assigned tasks</p>
          ) : (
            tasks.map((row) => (
              <DropdownMenuItem key={`task-${row.projectId}-${row.id}`} className="cursor-pointer p-0">
                <Link
                  href={row.href}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left no-underline hover:bg-flowpm-canvas"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-sm font-medium text-flowpm-body">{row.title}</span>
                  <span className="text-xs text-flowpm-muted capitalize">
                    Status: {row.status.replace(/_/g, " ")}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))
          )}

          <SectionTitle>Task comments</SectionTitle>
          {comments.length === 0 ? (
            <p className="px-3 py-2 text-xs text-flowpm-muted">No recent comments from teammates</p>
          ) : (
            comments.map((row) => (
              <DropdownMenuItem key={`com-${row.id}`} className="cursor-pointer p-0">
                <Link
                  href={row.href}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left no-underline hover:bg-flowpm-canvas"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-sm font-medium text-flowpm-body">{row.userName}</span>
                  <span className="text-xs text-flowpm-muted">
                    On “{row.taskTitle}” — {row.preview}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>

        {desktopPermission === "unsupported" ? null : (
          <div className="border-t border-flowpm-border px-3 py-2">
            {desktopPermission === "default" ? (
              <button
                type="button"
                className="text-xs font-medium text-flowpm-primary hover:underline"
                onClick={() => void requestDesktopPermission()}
              >
                Enable desktop notifications
              </button>
            ) : desktopPermission === "denied" ? (
              <p className="text-xs text-flowpm-muted">
                Desktop alerts blocked — allow notifications for this site in browser settings.
              </p>
            ) : (
              <p className="text-xs text-flowpm-muted">Desktop alerts on for new items.</p>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
