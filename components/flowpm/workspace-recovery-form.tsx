"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkspaceForNewUser } from "@/lib/firebase/create-workspace";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function errorText(err: unknown): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Could not create workspace. Try again.";
}

export function WorkspaceRecoveryForm() {
  const router = useRouter();
  const { firebaseUser, refreshProfile } = useFlowAuth();
  const [orgName, setOrgName] = useState("");
  const [displayName, setDisplayName] = useState(() => firebaseUser?.displayName?.trim() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!firebaseUser) return null;

  const emailPreview = firebaseUser.email ?? "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const user = firebaseUser;
    if (!user) return;
    const email = user.email ?? "";
    setError(null);
    const org = orgName.trim();
    const name = displayName.trim() || email.split("@")[0] || "User";
    if (!email) {
      setError("Your account has no email on file. Sign out and sign in again.");
      return;
    }
    if (org.length < 2) {
      setError("Organization name must be at least 2 characters.");
      return;
    }
    setPending(true);
    try {
      await user.getIdToken(true);
      await createWorkspaceForNewUser({
        uid: user.uid,
        email: email.toLowerCase(),
        displayName: name,
        orgName: org,
      });
      await refreshProfile();
      router.refresh();
    } catch (err: unknown) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md space-y-4 rounded-xl border border-flowpm-border bg-white p-6 shadow-card"
    >
      <div className="space-y-2">
        <Label htmlFor="recovery-name">Your name</Label>
        <Input
          id="recovery-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How we should address you"
          className="h-10"
          autoComplete="name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recovery-org">Organization name</Label>
        <Input
          id="recovery-org"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Your team or company"
          required
          minLength={2}
          className="h-10"
        />
      </div>
      {emailPreview ? (
        <p className="text-xs text-flowpm-muted">
          Signed in as <span className="font-medium text-flowpm-dark">{emailPreview}</span>
        </p>
      ) : null}
      {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
      <Button
        type="submit"
        disabled={pending}
        className="h-10 w-full bg-flowpm-primary hover:bg-flowpm-primary-hover"
      >
        {pending ? "Creating workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
