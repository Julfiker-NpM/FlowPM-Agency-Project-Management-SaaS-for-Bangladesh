"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function InvitePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get("org")?.trim() ?? "";
  const token = searchParams.get("t")?.trim() ?? "";
  const { firebaseUser, loading, refreshProfile, authReady } = useFlowAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !token || !firebaseUser?.email) return;
    const db = getFirebaseDb();
    let cancelled = false;
    (async () => {
      const ref = doc(db, "organizations", orgId, "invites", token);
      const snap = await getDoc(ref);
      if (cancelled || !snap.exists()) return;
      const data = snap.data() as Record<string, unknown>;
      setInviteOrgName((data.organizationName as string) || "Workspace");
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, token, firebaseUser?.email]);

  useEffect(() => {
    if (!authReady || loading) return;
    if (!orgId || !token) return;
    if (firebaseUser) return;
    const next = `/invite?org=${encodeURIComponent(orgId)}&t=${encodeURIComponent(token)}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [authReady, loading, firebaseUser, orgId, token, router]);

  async function accept() {
    const user = getFirebaseAuth().currentUser;
    if (!user) return;
    const userEmail = user.email;
    if (!userEmail || !orgId || !token) return;
    setError(null);
    setBusy(true);
    try {
      const db = getFirebaseDb();
      const invRef = doc(db, "organizations", orgId, "invites", token);
      const memRef = doc(db, "organizations", orgId, "members", user.uid);
      const userRef = doc(db, "users", user.uid);

      await runTransaction(db, async (tx) => {
        const invSnap = await tx.get(invRef);
        if (!invSnap.exists()) throw new Error("INVITE_GONE");
        const data = invSnap.data() as Record<string, unknown>;
        const em = String(data.email ?? "").toLowerCase();
        if (em !== userEmail.toLowerCase()) throw new Error("EMAIL_MISMATCH");
        const role = (data.role as string) || "member";
        if (!["admin", "member", "viewer"].includes(role)) throw new Error("BAD_ROLE");

        const existingMem = await tx.get(memRef);
        if (!existingMem.exists()) {
          tx.set(memRef, {
            role,
            email: userEmail,
            name: user.displayName || userEmail.split("@")[0] || "Member",
            joinedAt: serverTimestamp(),
          });
        }

        tx.set(
          userRef,
          {
            email: userEmail,
            name: user.displayName || userEmail.split("@")[0],
            currentOrgId: orgId,
          },
          { merge: true },
        );

        tx.delete(invRef);
      });

      await user.getIdToken(true);
      await refreshProfile();
      router.replace("/dashboard");
      router.refresh();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const code = e instanceof Error ? e.message : "";
      if (code === "EMAIL_MISMATCH") {
        setError("Sign in with the email this invite was sent to, then try again.");
      } else if (code === "INVITE_GONE") {
        setError("This invite is no longer valid. Ask for a new invite.");
      } else if (err.code === "permission-denied") {
        setError(
          "Permission denied (Firestore rules). Deploy the latest rules: firebase deploy --only firestore:rules — or ask your admin.",
        );
      } else {
        console.error("Invite accept failed", e);
        setError("Could not join workspace. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!orgId || !token) {
    return (
      <Card className="mx-auto max-w-md border-flowpm-border">
        <CardContent className="pt-6 text-sm text-flowpm-muted">Invalid invite link.</CardContent>
      </Card>
    );
  }

  if (!authReady || loading || !firebaseUser) {
    return (
      <p className="text-center text-sm text-flowpm-muted">
        {!authReady || loading ? "Loading…" : "Redirecting to sign in…"}
      </p>
    );
  }

  return (
    <Card className="mx-auto max-w-md border-flowpm-border shadow-card">
      <CardHeader>
        <CardTitle className="font-heading text-xl">Join workspace</CardTitle>
        <p className="text-sm text-flowpm-muted">
          You&apos;ve been invited to <strong className="text-flowpm-body">{inviteOrgName ?? "…"}</strong>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-flowpm-muted">
          Signed in as <span className="font-medium text-flowpm-body">{firebaseUser.email}</span>
        </p>
        {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
        <Button
          type="button"
          className="h-10 w-full bg-flowpm-primary hover:bg-flowpm-primary-hover"
          disabled={busy}
          onClick={() => void accept()}
        >
          {busy ? "Joining…" : "Accept & open dashboard"}
        </Button>
        <p className="text-center text-sm">
          <Link href="/dashboard" className="text-flowpm-primary hover:underline">
            Cancel
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={<p className="text-center text-sm text-flowpm-muted">Loading…</p>}
    >
      <InvitePageInner />
    </Suspense>
  );
}
