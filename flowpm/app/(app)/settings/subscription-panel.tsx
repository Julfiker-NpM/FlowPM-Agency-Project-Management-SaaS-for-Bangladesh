"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  getPlanLimits,
  isFreePlan,
  planDisplayLabel,
  subscriptionUpgradeHint,
} from "@/lib/flowpm/plan-limits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function usageBar(current: number, max: number | null) {
  if (max == null) return null;
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-flowpm-muted">
        {current} of {max} used
        {current >= max ? <span className="font-medium text-flowpm-warning"> — at limit</span> : null}
      </p>
    </div>
  );
}

export function SubscriptionPanel(props: {
  orgId: string;
  plan: string;
  canManageBilling: boolean;
}) {
  const { orgId, plan, canManageBilling } = props;
  const [loading, setLoading] = useState(true);
  const [projectCount, setProjectCount] = useState(0);
  const [seatCount, setSeatCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getFirebaseDb();
      try {
        const [projSnap, memSnap, invSnap] = await Promise.all([
          getDocs(collection(db, "organizations", orgId, "projects")),
          getDocs(collection(db, "organizations", orgId, "members")),
          getDocs(collection(db, "organizations", orgId, "invites")),
        ]);
        if (!cancelled) {
          setProjectCount(projSnap.size);
          setSeatCount(memSnap.size + invSnap.size);
        }
      } catch {
        if (!cancelled) {
          setProjectCount(0);
          setSeatCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const limits = useMemo(() => getPlanLimits(plan), [plan]);
  const label = planDisplayLabel(plan);
  const portalUrl =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL?.trim() : "";

  return (
    <Card className="border-flowpm-border shadow-card">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="font-heading text-lg">Subscription</CardTitle>
          <p className="mt-1 text-sm text-flowpm-muted">Plan limits and workspace usage.</p>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "capitalize",
            isFreePlan(plan)
              ? "bg-flowpm-canvas text-flowpm-muted dark:bg-white/10"
              : "bg-flowpm-primary text-white dark:bg-flowpm-primary",
          )}
        >
          {label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {loading ? (
          <p className="text-flowpm-muted">Loading usage…</p>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-flowpm-body">Projects</p>
                {limits.maxProjects != null ? (
                  <>
                    {usageBar(projectCount, limits.maxProjects)}
                    <p className="mt-1 text-xs text-flowpm-muted">
                      Free workspaces can have up to {limits.maxProjects} active projects.
                    </p>
                  </>
                ) : (
                  <p className="text-flowpm-muted">
                    {projectCount} project{projectCount === 1 ? "" : "s"} — no project cap on your current plan.
                  </p>
                )}
              </div>
              <Separator />
              <div>
                <p className="font-medium text-flowpm-body">Seats (members + pending invites)</p>
                {limits.maxMembers != null ? (
                  <>
                    {usageBar(seatCount, limits.maxMembers)}
                    <p className="mt-1 text-xs text-flowpm-muted">
                      Each member and each pending invite counts toward this limit.
                    </p>
                  </>
                ) : (
                  <p className="text-flowpm-muted">
                    {seatCount} seat{seatCount === 1 ? "" : "s"} in use — no seat cap on your current plan.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-3">
          <p className="font-medium text-flowpm-body">Billing</p>
          <p className="text-flowpm-muted">{subscriptionUpgradeHint()}</p>
          <div className="flex flex-wrap gap-2">
            {portalUrl && canManageBilling ? (
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "inline-flex h-10 items-center justify-center px-4 bg-flowpm-primary hover:bg-flowpm-primary-hover",
                )}
              >
                Manage subscription
              </a>
            ) : (
              <Button type="button" variant="outline" className="h-10" disabled>
                Manage subscription
              </Button>
            )}
            {isFreePlan(plan) && canManageBilling ? (
              <Button type="button" variant="secondary" className="h-10" disabled title={subscriptionUpgradeHint()}>
                Upgrade to Pro
              </Button>
            ) : null}
          </div>
          {portalUrl && canManageBilling ? (
            <p className="text-xs text-flowpm-muted">Opens your Stripe customer portal in a new tab.</p>
          ) : null}
          {!canManageBilling ? (
            <p className="text-xs text-flowpm-muted">Only workspace owners and admins can change billing.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
