"use client";

import Link from "next/link";
import { PageMotion } from "@/components/flowpm/page-motion";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import { canUseInvoices } from "@/lib/flowpm/plan-limits";
import { cn } from "@/lib/utils";
import { InvoicesClient } from "./invoices-client";

export default function InvoicesPage() {
  const { orgId, org, authReady } = useFlowAuth();

  if (!authReady) {
    return <p className="text-sm text-flowpm-muted">Loading…</p>;
  }
  if (!orgId) {
    return <p className="text-sm text-flowpm-muted">You need an active workspace.</p>;
  }

  if (!canUseInvoices(org?.plan)) {
    return (
      <PageMotion>
        <Card className="mx-auto max-w-lg border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Invoices</CardTitle>
            <p className="text-sm text-flowpm-muted">
              Invoice generation is on <strong className="text-flowpm-body">Pro</strong> and{" "}
              <strong className="text-flowpm-body">Ultra</strong>.
            </p>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "default" }),
                "inline-flex h-10 items-center justify-center px-4 bg-flowpm-primary hover:bg-flowpm-primary-hover",
              )}
            >
              View plans &amp; upgrade
            </Link>
          </CardContent>
        </Card>
      </PageMotion>
    );
  }

  return <InvoicesClient orgId={orgId} />;
}
