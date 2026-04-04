"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { AppSidebar } from "@/components/flowpm/app-sidebar";
import { TopBar } from "@/components/flowpm/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { firebaseUser, profile, org, orgId, loading } = useFlowAuth();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace("/login");
    }
  }, [loading, firebaseUser, router]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-flowpm-canvas text-sm text-flowpm-muted">
        Loading…
      </div>
    );
  }

  if (!profile || !orgId || !org) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-flowpm-canvas px-4 text-center">
        <p className="text-sm text-flowpm-muted">No workspace linked to this account.</p>
        <p className="text-xs text-flowpm-muted">Sign up again with a new organization or contact support.</p>
        <button
          type="button"
          className="mt-2 text-sm text-flowpm-primary hover:underline"
          onClick={() => signOut(getFirebaseAuth())}
        >
          Sign out
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
