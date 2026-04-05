"use client";

import { useFlowAuth } from "@/context/flowpm-auth-context";
import { ReportsClient } from "./reports-client";

export default function ReportsPage() {
  const { orgId, authReady } = useFlowAuth();

  if (!authReady) {
    return <p className="text-sm text-flowpm-muted">Loading…</p>;
  }
  if (!orgId) {
    return <p className="text-sm text-flowpm-muted">You need an active workspace.</p>;
  }

  return <ReportsClient orgId={orgId} />;
}
