"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { AppSidebar } from "@/components/flowpm/app-sidebar";
import { TopBar } from "@/components/flowpm/top-bar";
import { FirebaseEnvMissingMessage } from "@/components/flowpm/firebase-env-missing-message";
import { WorkspaceRecoveryForm } from "@/components/flowpm/workspace-recovery-form";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { firebaseUser, profile, org, orgId, loading, configMissing } = useFlowAuth();

  useEffect(() => {
    if (configMissing) return;
    if (!loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router, configMissing]);

  if (configMissing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-flowpm-canvas px-4 py-12">
        <div className="w-full max-w-lg">
          <FirebaseEnvMissingMessage />
        </div>
      </div>
    );
  }

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-flowpm-canvas text-sm text-flowpm-muted">
        Loading…
      </div>
    );
  }

  if (!profile || !orgId || !org) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-flowpm-canvas px-4 py-12">
        <div className="max-w-md text-center">
          <p className="text-base font-medium text-flowpm-dark">Finish setting up your workspace</p>
          <p className="mt-2 text-sm text-flowpm-muted">
            You&apos;re signed in, but FlowPM doesn&apos;t have a workspace for this account yet. That can happen if
            setup was interrupted. Create your organization below—no need to register again.
          </p>
        </div>
        <WorkspaceRecoveryForm />
        <button
          type="button"
          className="text-sm text-flowpm-primary hover:underline"
          onClick={() => signOut(getFirebaseAuth())}
        >
          Sign out and use a different account
        </button>
      </div>
    );
  }

  const email = profile.email || firebaseUser.email || "";
  const displayName = profile.name?.trim() || firebaseUser.displayName?.trim() || email.split("@")[0] || "Account";

  const handleSignOut = () => signOut(getFirebaseAuth());

  return (
    <div className="flex min-h-screen bg-flowpm-canvas">
      <AppSidebar
        userDisplayName={displayName}
        userEmail={email}
        organizationName={org.name}
        onSignOut={handleSignOut}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={{ name: profile.name, email }}
          organizationName={org.name}
          onSignOut={handleSignOut}
        />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
