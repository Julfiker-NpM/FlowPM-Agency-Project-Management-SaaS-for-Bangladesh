"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm } from "./login-form";
import { useFlowAuth } from "@/context/flowpm-auth-context";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser, loading } = useFlowAuth();

  const raw = searchParams.get("next");
  const nextPath =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  useEffect(() => {
    if (!loading && firebaseUser) {
      router.replace(nextPath);
    }
  }, [loading, firebaseUser, router, nextPath]);

  if (loading || firebaseUser) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-flowpm-muted">Loading…</div>
    );
  }

  return <LoginForm nextPath={nextPath} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-flowpm-muted">Loading…</div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
