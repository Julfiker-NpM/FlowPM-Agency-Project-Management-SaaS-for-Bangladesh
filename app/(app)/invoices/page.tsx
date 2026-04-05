"use client";

import { useFlowAuth } from "@/context/flowpm-auth-context";
import { InvoicesClient } from "./invoices-client";

export default function InvoicesPage() {
  const { orgId, authReady } = useFlowAuth();

  if (!authReady) {
    return <p className="text-sm text-flowpm-muted">Loading…</p>;
  }
  if (!orgId) {
    return <p className="text-sm text-flowpm-muted">You need an active workspace.</p>;
  }

  return <InvoicesClient orgId={orgId} />;
}
