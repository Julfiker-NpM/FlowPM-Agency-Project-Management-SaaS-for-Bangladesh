"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import {
  FREE_PLAN_MAX_MEMBERS,
  freePlanMemberLimitMessage,
  isFreePlan,
} from "@/lib/flowpm/plan-limits";
import { PageMotion } from "@/components/flowpm/page-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type PendingInviteRow = {
  id: string;
  email: string;
  role: string;
};

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return email[0]?.toUpperCase() ?? "?";
}

function randomInviteToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

const MANAGEABLE_ROLES = ["admin", "member", "viewer"] as const;
type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export function TeamClient(props: {
  members: TeamMemberRow[];
  orgId: string;
  organizationName: string;
  orgPlan: string | null | undefined;
  workspaceOwnerId: string | null;
  currentUserId: string;
  canInvite: boolean;
  reloadKey: number;
  onMembersChanged: () => void;
}) {
  const {
    members,
    orgId,
    organizationName,
    orgPlan,
    workspaceOwnerId,
    currentUserId,
    canInvite,
    reloadKey,
    onMembersChanged,
  } = props;
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [invites, setInvites] = useState<PendingInviteRow[]>([]);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [teamActionError, setTeamActionError] = useState<string | null>(null);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [inviteRevokeBusyId, setInviteRevokeBusyId] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    if (!canInvite || !orgId) return;
    const db = getFirebaseDb();
    const snap = await getDocs(collection(db, "organizations", orgId, "invites"));
    const rows: PendingInviteRow[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        email: (data.email as string) || "",
        role: (data.role as string) || "member",
      };
    });
    rows.sort((a, b) => a.email.localeCompare(b.email));
    setInvites(rows);
  }, [canInvite, orgId]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites, reloadKey]);

  async function onCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setEmailStatus(null);
    const addr = email.trim().toLowerCase();
    if (addr.length < 5 || !addr.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    try {
      const db = getFirebaseDb();
      if (isFreePlan(orgPlan)) {
        const [membersSnap, invitesSnap] = await Promise.all([
          getDocs(collection(db, "organizations", orgId, "members")),
          getDocs(collection(db, "organizations", orgId, "invites")),
        ]);
        if (membersSnap.size + invitesSnap.size >= FREE_PLAN_MAX_MEMBERS) {
          setError(freePlanMemberLimitMessage(FREE_PLAN_MAX_MEMBERS));
          setPending(false);
          return;
        }
      }
      const token = randomInviteToken();
      await setDoc(doc(db, "organizations", orgId, "invites", token), {
        email: addr,
        role,
        invitedByUid: currentUserId,
        organizationName,
        createdAt: serverTimestamp(),
      });
      const link = `${typeof window !== "undefined" ? window.location.origin : ""}/invite?org=${encodeURIComponent(orgId)}&t=${encodeURIComponent(token)}`;
      setInviteLink(link);
      setEmail("");
      await loadInvites();

      const authUser = getFirebaseAuth().currentUser;
      const idToken = authUser ? await authUser.getIdToken() : null;
      if (idToken) {
        try {
          const res = await fetch("/api/invite-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ orgId, token, inviteeEmail: addr }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            sent?: boolean;
            reason?: string;
            message?: string;
            error?: string;
          };
          if (res.ok && data.sent) {
            setEmailStatus("Invitation email sent.");
          } else if (data.reason === "missing_resend" || data.reason === "missing_admin") {
            setEmailStatus(data.message ?? "Invite saved. Configure server env vars to send email automatically.");
          } else if (!res.ok) {
            setEmailStatus(data.error ?? "Invite saved; automatic email failed. Use Copy link.");
          }
        } catch {
          setEmailStatus("Invite saved; could not reach email service. Use Copy link.");
        }
      }
    } catch {
      setError("Could not create invite. Check permissions and try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      /* ignore */
    }
  }

  function isProtectedOwnerRow(memberId: string) {
    if (workspaceOwnerId && memberId === workspaceOwnerId) return true;
    const row = members.find((x) => x.id === memberId);
    return String(row?.role ?? "").toLowerCase() === "owner";
  }

  async function revokeInvite(inviteDocId: string) {
    if (!canInvite) return;
    setInviteRevokeBusyId(inviteDocId);
    setTeamActionError(null);
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, "organizations", orgId, "invites", inviteDocId));
      await loadInvites();
    } catch {
      setTeamActionError("Could not revoke invite.");
    } finally {
      setInviteRevokeBusyId(null);
    }
  }

  async function saveMemberRole(memberId: string, nextRole: ManageableRole) {
    if (!canInvite || isProtectedOwnerRow(memberId)) return;
    setMemberBusyId(memberId);
    setTeamActionError(null);
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "organizations", orgId, "members", memberId), { role: nextRole });
      onMembersChanged();
    } catch {
      setTeamActionError("Could not update role. Check permissions or try again.");
    } finally {
      setMemberBusyId(null);
    }
  }

  async function removeMemberFromWorkspace(memberId: string) {
    if (!canInvite || isProtectedOwnerRow(memberId)) return;
    if (
      !window.confirm(
        "Remove this person from the workspace? They will lose access until someone invites them again.",
      )
    ) {
      return;
    }
    setMemberBusyId(memberId);
    setTeamActionError(null);
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, "organizations", orgId, "members", memberId));
      onMembersChanged();
    } catch {
      setTeamActionError("Could not remove member.");
    } finally {
      setMemberBusyId(null);
    }
  }

  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-flowpm-muted">
          Invite members and assign roles (Admin / Member / Viewer). Owners and admins can change roles or remove
          members (except the workspace owner).
        </p>
        <Button
          type="button"
          className="h-10 bg-flowpm-primary hover:bg-flowpm-primary-hover"
          disabled={!canInvite}
          onClick={() => {
            setModalOpen(true);
            setError(null);
            setInviteLink(null);
            setEmailStatus(null);
          }}
        >
          Invite member
        </Button>
      </div>

      {!canInvite ? (
        <p className="mb-4 text-xs text-flowpm-muted">Only owners and admins can send invites or manage roles.</p>
      ) : null}

      {teamActionError ? <p className="mb-4 text-sm text-flowpm-danger">{teamActionError}</p> : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-title"
        >
          <Card className="relative w-full max-w-md border-flowpm-border shadow-lg">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <CardTitle id="invite-title" className="font-heading text-lg">
                Invite to {organizationName}
              </CardTitle>
              <button
                type="button"
                className="text-sm text-flowpm-muted hover:text-flowpm-body"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={onCreateInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    placeholder="colleague@company.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    className="flex h-10 w-full rounded-md border border-flowpm-border bg-flowpm-surface px-3 text-sm text-flowpm-body"
                    value={role}
                    onChange={(ev) => setRole(ev.target.value as typeof role)}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
                {inviteLink ? (
                  <div className="rounded-md border border-flowpm-border bg-flowpm-canvas p-3 text-xs">
                    <p className="mb-2 font-medium text-flowpm-body">Invite link (copy and send)</p>
                    <p className="break-all text-flowpm-muted">{inviteLink}</p>
                    {emailStatus ? (
                      <p
                        className={
                          emailStatus.startsWith("Invitation email sent")
                            ? "mt-2 text-flowpm-success"
                            : "mt-2 text-flowpm-muted"
                        }
                      >
                        {emailStatus}
                      </p>
                    ) : null}
                    <Button type="button" variant="outline" className="mt-2 h-9 w-full" onClick={copyLink}>
                      Copy link
                    </Button>
                    <p className="mt-2 text-flowpm-muted">
                      They must sign in with this exact email, then open the link to join.
                    </p>
                  </div>
                ) : null}
                <Button type="submit" className="h-10 w-full bg-flowpm-primary hover:bg-flowpm-primary-hover" disabled={pending}>
                  {pending ? "Creating…" : inviteLink ? "Create another invite" : "Create invite link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {canInvite && invites.length > 0 ? (
        <Card className="mb-6 border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invites.map((inv) => {
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/invite?org=${encodeURIComponent(orgId)}&t=${encodeURIComponent(inv.id)}`;
              return (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-flowpm-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-flowpm-body">{inv.email}</p>
                    <p className="text-xs capitalize text-flowpm-muted">{inv.role}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => void navigator.clipboard.writeText(link)}
                    >
                      Copy link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-flowpm-danger hover:text-flowpm-danger"
                      disabled={inviteRevokeBusyId === inv.id}
                      onClick={() => void revokeInvite(inv.id)}
                    >
                      {inviteRevokeBusyId === inv.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-flowpm-border shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.length === 0 ? (
            <p className="text-sm text-flowpm-muted">No members yet.</p>
          ) : (
            members.map((m) => {
              const ownerRow = isProtectedOwnerRow(m.id);
              const busy = memberBusyId === m.id;
              const r = String(m.role || "member").toLowerCase();
              const manageable = MANAGEABLE_ROLES.includes(r as ManageableRole);
              const selectRole: ManageableRole = manageable ? (r as ManageableRole) : "member";

              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-flowpm-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-flowpm-primary-light text-[10px] font-medium text-flowpm-primary">
                        {initials(m.name, m.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-flowpm-body">
                        {m.name || m.email}
                        {m.id === currentUserId ? (
                          <span className="ml-1 text-xs font-normal text-flowpm-muted">(you)</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-flowpm-muted">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ownerRow ? (
                      <Badge variant="secondary" className="bg-flowpm-primary-light capitalize text-flowpm-primary">
                        Owner
                      </Badge>
                    ) : canInvite ? (
                      <>
                        <select
                          aria-label={`Role for ${m.email}`}
                          className="h-9 min-w-[7.5rem] rounded-md border border-flowpm-border bg-flowpm-surface px-2 text-sm text-flowpm-body disabled:opacity-50"
                          value={selectRole}
                          disabled={busy}
                          onChange={(ev) =>
                            void saveMemberRole(m.id, ev.target.value as ManageableRole)
                          }
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 text-flowpm-danger hover:text-flowpm-danger"
                          disabled={busy || m.id === currentUserId}
                          title={
                            m.id === currentUserId
                              ? "Ask another admin to remove you, or transfer ownership first."
                              : undefined
                          }
                          onClick={() => void removeMemberFromWorkspace(m.id)}
                        >
                          {busy ? "…" : "Remove"}
                        </Button>
                      </>
                    ) : (
                      <Badge variant="secondary" className="bg-flowpm-primary-light capitalize text-flowpm-primary">
                        {m.role}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </PageMotion>
  );
}
