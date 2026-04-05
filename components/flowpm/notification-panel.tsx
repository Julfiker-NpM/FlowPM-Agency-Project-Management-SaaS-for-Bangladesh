"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  collectionGroup,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
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

function mapInviteDocs(snapshot: QuerySnapshot): InviteNotificationRow[] {
  const rows: InviteNotificationRow[] = [];
  for (const d of snapshot.docs) {
    const orgId = orgIdFromInviteDoc(d);
    if (!orgId) continue;
    const data = d.data() as Record<string, unknown>;
    rows.push({
      token: d.id,
      orgId,
      organizationName: String(data.organizationName ?? "Workspace"),
      role: String(data.role ?? "member"),
      href: `/invite?org=${encodeURIComponent(orgId)}&t=${encodeURIComponent(d.id)}`,
    });
  }
  return rows;
}

function orgProjectFromTaskDoc(d: QueryDocumentSnapshot): { orgId: string; projectId: string } | null {
  const projectDoc = d.ref.parent?.parent;
  const projectsCol = projectDoc?.parent;
  const orgDoc = projectsCol?.parent;
  const orgId = orgDoc?.id ?? null;
  const projectId = projectDoc?.id ?? null;
  if (!orgId || !projectId) return null;
  return { orgId, projectId };
}

function mapAssignedTasks(
  snapshot: QuerySnapshot,
  currentOrgId: string,
): TaskAssignRow[] {
  const rows: TaskAssignRow[] = [];
  for (const d of snapshot.docs) {
    const loc = orgProjectFromTaskDoc(d);
    if (!loc || loc.orgId !== currentOrgId) continue;
    const data = d.data() as Record<string, unknown>;
    const status = String(data.status ?? "todo");
    if (status === "done") continue;
    const title = String(data.title ?? "Task");
    rows.push({
      id: d.id,
      orgId: loc.orgId,
      projectId: loc.projectId,
      title,
      status,
      href: `/projects/${loc.projectId}`,
    });
  }
  rows.sort((a, b) => a.title.localeCompare(b.title));
  return rows;
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
  /** Profile or auth email; invite docs match auth token email (lowercase). */
  userEmail: string;
  userId: string;
  orgId: string;
}) {
  const { userEmail, userId, orgId } = props;
  const normalizedEmail = useMemo(() => {
    const e = userEmail.trim().toLowerCase();
    return e.includes("@") ? e : "";
  }, [userEmail]);

  const [invites, setInvites] = useState<InviteNotificationRow[]>([]);
  const [tasks, setTasks] = useState<TaskAssignRow[]>([]);
  const [comments, setComments] = useState<TaskCommentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  useEffect(() => {
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setInvites([]);
      return;
    }

    const db = getFirebaseDb();
    const q = query(collectionGroup(db, "invites"), where("email", "==", normalizedEmail));
    let first = true;

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows = mapInviteDocs(snapshot);
        if (!first) {
          for (const ch of snapshot.docChanges()) {
            if (ch.type === "added") {
              const oid = orgIdFromInviteDoc(ch.doc);
              if (!oid) continue;
              const data = ch.doc.data() as Record<string, unknown>;
              const orgName = String(data.organizationName ?? "Workspace");
              notifyDesktop(
                "Workspace invite",
                `You're invited to ${orgName}.`,
                `flowpm-invite-${oid}-${ch.doc.id}`,
              );
            }
          }
        } else {
          first = false;
        }
        setInvites(rows);
      },
      (listenerErr) => {
        console.error("[FlowPM] invite notifications query failed", listenerErr);
        setInvites([]);
      },
    );

    return () => unsub();
  }, [normalizedEmail]);

  useEffect(() => {
    if (!userId || !orgId) {
      setTasks([]);
      return;
    }

    const db = getFirebaseDb();
    const q = query(collectionGroup(db, "tasks"), where("assigneeId", "==", userId));
    let first = true;

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows = mapAssignedTasks(snapshot, orgId);
        if (!first) {
          for (const ch of snapshot.docChanges()) {
            if (ch.type !== "added") continue;
            const loc = orgProjectFromTaskDoc(ch.doc);
            if (!loc || loc.orgId !== orgId) continue;
            const data = ch.doc.data() as Record<string, unknown>;
            if (String(data.status ?? "") === "done") continue;
            if (String(data.assigneeId ?? "") !== userId) continue;
            const title = String(data.title ?? "Task");
            notifyDesktop(
              "Task assigned",
              `${title} — open FlowPM to view.`,
              `flowpm-task-${loc.projectId}-${ch.doc.id}`,
            );
          }
        } else {
          first = false;
        }
        setTasks(rows);
      },
      () => setTasks([]),
    );

    return () => unsub();
  }, [userId, orgId]);

  useEffect(() => {
    if (!userId || !orgId) {
      setComments([]);
      return;
    }

    const db = getFirebaseDb();
    const q = query(
      collection(db, "organizations", orgId, "taskComments"),
      orderBy("createdAt", "desc"),
      limit(25),
    );
    let first = true;

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows: TaskCommentRow[] = [];
        for (const d of snapshot.docs) {
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
      () => setComments([]),
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
