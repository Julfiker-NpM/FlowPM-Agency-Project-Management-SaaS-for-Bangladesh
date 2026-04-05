"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRedirectResult } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { SignupForm } from "./signup-form";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { FirebaseEnvMissingMessage } from "@/components/flowpm/firebase-env-missing-message";

export default function SignupPage() {
  const router = useRouter();
  const { firebaseUser, loading, configMissing, authReady } = useFlowAuth();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getRedirectResult(getFirebaseAuth());
        if (cancelled || !result?.user) return;
        router.replace("/dashboard");
        router.refresh();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (configMissing || !authReady) return;
    if (!loading && firebaseUser) {
      router.replace("/dashboard");
    }
  }, [configMissing, authReady, loading, firebaseUser, router]);

  if (configMissing) {
    return <FirebaseEnvMissingMessage />;
  }

  if (!authReady || loading || firebaseUser) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-flowpm-muted">Loading…</div>
    );
  }

  return <SignupForm />;
}
