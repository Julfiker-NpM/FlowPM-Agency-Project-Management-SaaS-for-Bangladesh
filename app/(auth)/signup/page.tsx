"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignupForm } from "./signup-form";
import { useFlowAuth } from "@/context/flowpm-auth-context";

export default function SignupPage() {
  const router = useRouter();
  const { firebaseUser, loading } = useFlowAuth();

  useEffect(() => {
    if (!loading && firebaseUser) {
      router.replace("/dashboard");
    }
  }, [loading, firebaseUser, router]);

  if (loading || firebaseUser) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-flowpm-muted">Loading…</div>
    );
  }

  return <SignupForm />;
}
