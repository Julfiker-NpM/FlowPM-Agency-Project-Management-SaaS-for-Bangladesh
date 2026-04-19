"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  getPlanLimits,
  normalizeBillingTier,
  planDisplayLabel,
  PRICING_TIERS,
  stripeCheckoutUrl,
} from "@/lib/flowpm/plan-limits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Lightbulb, X } from "lucide-react";

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

type BillingChoice = "pro" | "agency";

type ManageModalProps = {
  open: boolean;
  onClose: () => void;
  plan: string;
  canManageBilling: boolean;
};

function SubscriptionManageModal(props: ManageModalProps) {
  const { open, onClose, plan, canManageBilling } = props;
  const [selectedTier, setSelectedTier] = useState<BillingChoice | null>(null);

  useEffect(() => {
    if (open) setSelectedTier(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const currentTier = normalizeBillingTier(plan);
  const portalUrl =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL?.trim() : "";
  const proCheckout = stripeCheckoutUrl("pro");
  const agencyCheckout = stripeCheckoutUrl("agency");

  const tierLabel = selectedTier === "pro" ? "Pro" : selectedTier === "agency" ? "Ultra" : null;
  const bkashHref = selectedTier ? `/api/checkout/bkash?plan=${selectedTier}` : "";
  const nagadHref = selectedTier ? `/api/checkout/nagad?plan=${selectedTier}` : "";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 z-[1] bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-manage-title"
        className="relative z-[2] flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-flowpm-border bg-flowpm-surface shadow-2xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-flowpm-border px-4 py-3 sm:px-5">
          <div>
            <h2 id="subscription-manage-title" className="font-heading text-lg font-semibold text-flowpm-dark">
              Manage subscription
            </h2>
            <p className="mt-0.5 text-xs text-flowpm-muted">
              Pick a plan, then pay with card (Stripe) or continue with bKash / Nagad.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          {portalUrl ? (
            <div className="mb-5">
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "inline-flex h-10 w-full items-center justify-center sm:w-auto",
                )}
              >
                Open Stripe billing portal
              </a>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-4 sm:p-5 dark:border-white/10">
            <h3 className="font-heading text-base font-semibold tracking-tight text-[#e8e4dc]">Plans</h3>
            <p className="mt-1 text-xs text-[#a8a8b8] sm:text-sm">Prices in BDT (৳). Choose a plan, then use payment below.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PRICING_TIERS.map((tier) => {
                const isCurrent = tier.id === currentTier;
                const showProCta = tier.id === "pro" && currentTier === "starter" && canManageBilling;
                const showAgencyFromPro = tier.id === "agency" && currentTier === "pro" && canManageBilling;
                const showAgencyFromStarter = tier.id === "agency" && currentTier === "starter" && canManageBilling;

                let cta: ReactNode = null;
                if (isCurrent) {
                  cta = (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 h-9 w-full rounded-lg border-white/20 bg-transparent text-sm text-[#e8e4dc] hover:bg-white/5"
                      disabled
                    >
                      Current plan
                    </Button>
                  );
                } else if (tier.id === "starter") {
                  cta = (
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-3 h-9 w-full text-sm text-[#a8a8b8] hover:bg-white/5 hover:text-[#e8e4dc]"
                      disabled
                    >
                      Downgrade via support
                    </Button>
                  );
                } else if (tier.id === "pro" && showProCta) {
                  const url = proCheckout;
                  cta = url ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "default" }),
                          "inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#5DCAA5] text-sm font-medium text-[#04342C] hover:opacity-90",
                        )}
                      >
                        Pay with card (Stripe)
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 w-full rounded-lg border-white/25 bg-transparent text-sm text-[#e8e4dc] hover:bg-white/10",
                          selectedTier === "pro" && "ring-2 ring-[#5DCAA5]",
                        )}
                        onClick={() => setSelectedTier("pro")}
                      >
                        {selectedTier === "pro" ? "Pro — pay with bKash / Nagad below" : "Select Pro for bKash / Nagad"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      className={cn(
                        "mt-3 h-9 w-full rounded-lg bg-[#5DCAA5] text-sm text-[#04342C] hover:opacity-90",
                        selectedTier === "pro" && "ring-2 ring-white ring-offset-2 ring-offset-[#0c0c0c]",
                      )}
                      onClick={() => setSelectedTier("pro")}
                    >
                      {selectedTier === "pro" ? "Pro selected — pay below" : "Select Pro"}
                    </Button>
                  );
                } else if (tier.id === "pro" && currentTier === "agency") {
                  cta = (
                    <p className="mt-3 text-center text-[11px] text-[#a8a8b8]">Ultra includes Pro features.</p>
                  );
                } else if (tier.id === "agency" && (showAgencyFromPro || showAgencyFromStarter) && canManageBilling) {
                  const url = agencyCheckout;
                  cta = url ? (
                    <div className="mt-3 flex flex-col gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "default" }),
                          "inline-flex h-9 w-full items-center justify-center rounded-lg border border-white/15 bg-[#1a1a1a] text-sm font-medium text-white hover:bg-white/10",
                        )}
                      >
                        Pay with card (Stripe)
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 w-full rounded-lg border-white/25 bg-transparent text-sm text-[#e8e4dc] hover:bg-white/10",
                          selectedTier === "agency" && "ring-2 ring-[#5DCAA5]",
                        )}
                        onClick={() => setSelectedTier("agency")}
                      >
                        {selectedTier === "agency" ? "Ultra — pay with bKash / Nagad below" : "Select Ultra for bKash / Nagad"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      className={cn(
                        "mt-3 h-9 w-full rounded-lg border border-white/15 bg-[#1a1a1a] text-sm text-white hover:bg-white/10",
                        selectedTier === "agency" && "ring-2 ring-[#5DCAA5]",
                      )}
                      onClick={() => setSelectedTier("agency")}
                    >
                      {selectedTier === "agency" ? "Ultra selected — pay below" : "Select Ultra"}
                    </Button>
                  );
                } else if (!canManageBilling && !isCurrent) {
                  cta = <p className="mt-3 text-center text-[11px] text-[#a8a8b8]">Ask an admin to change plans.</p>;
                }

                return (
                  <div
                    key={tier.id}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-lg",
                      tier.id === "pro" && "ring-2 ring-[#5DCAA5]/75 sm:scale-[1.02]",
                    )}
                  >
                    <div className={cn("border-b border-white/10 px-3 py-3", tier.headerClass)}>
                      <p className="font-heading text-sm font-semibold sm:text-base">{tier.name}</p>
                      <p className="mt-1 flex flex-wrap items-baseline gap-1">
                        <span className="text-xl font-bold sm:text-2xl">{tier.priceLine}</span>
                        <span className="text-xs opacity-90 sm:text-sm">{tier.priceSub}</span>
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col bg-[#0c0c0c] px-3 pb-3 pt-3">
                      <ul className="flex-1 space-y-1.5 text-xs text-[#e8e4dc]/90 sm:text-sm">
                        {tier.features.map((f) => (
                          <li key={f} className="flex gap-2">
                            <span className="mt-0.5 shrink-0 font-mono text-[#5DCAA5]" aria-hidden>
                              —
                            </span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      {cta}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2 rounded-xl border border-[#5DCAA5]/25 bg-[#5DCAA5]/10 p-3 sm:p-4">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#5DCAA5] sm:size-5" aria-hidden />
              <div className="text-xs text-[#e8e4dc] sm:text-sm">
                <p className="font-medium text-[#5DCAA5]">Tip</p>
                <p className="mt-1 text-[11px] text-[#a8a8b8] sm:text-xs">
                  Annual billing with two months free is popular with agencies.
                </p>
              </div>
            </div>
          </div>

          {selectedTier && tierLabel ? (
            <div className="mt-6 space-y-3 rounded-xl border border-flowpm-border bg-flowpm-canvas/40 p-4 dark:bg-white/5">
              <p className="font-medium text-flowpm-body">Pay for {tierLabel}</p>
              <p className="text-xs text-flowpm-muted">
                Continue to bKash or Nagad checkout. If your team has not added a payment link yet, you will see short
                instructions instead.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={bkashHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "inline-flex h-10 flex-1 min-w-[140px] items-center justify-center bg-[#E2136E] text-white hover:opacity-90 sm:flex-none sm:px-6",
                  )}
                >
                  Pay with bKash
                </a>
                <a
                  href={nagadHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "inline-flex h-10 flex-1 min-w-[140px] items-center justify-center bg-[#f7941d] text-[#1a1a1a] hover:opacity-90 sm:flex-none sm:px-6",
                  )}
                >
                  Pay with Nagad
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-center text-xs text-flowpm-muted">
              Select <strong className="text-flowpm-body">Pro</strong> or <strong className="text-flowpm-body">Ultra</strong> above
              to unlock bKash and Nagad.
            </p>
          )}
        </div>
      </div>
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
  const [manageOpen, setManageOpen] = useState(false);

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
  const currentTier = normalizeBillingTier(plan);
  const label = planDisplayLabel(plan);

  return (
    <div className="space-y-8">
      <Card className="border-flowpm-border shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
          <div>
            <CardTitle className="font-heading text-lg">Your subscription</CardTitle>
            <p className="mt-1 text-sm text-flowpm-muted">Usage against your current plan limits.</p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "capitalize",
              currentTier === "starter"
                ? "bg-[#f5f0e8] text-flowpm-dark dark:bg-white/10 dark:text-flowpm-body"
                : currentTier === "pro"
                  ? "bg-flowpm-primary text-white"
                  : "bg-[#1a1a2e] text-white dark:bg-black",
            )}
          >
            {label}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          {loading ? (
            <p className="text-flowpm-muted">Loading usage…</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-medium text-flowpm-body">Projects</p>
                {limits.maxProjects != null ? (
                  <>
                    {usageBar(projectCount, limits.maxProjects)}
                    <p className="mt-1 text-xs text-flowpm-muted">
                      Your plan allows up to {limits.maxProjects} active projects.
                    </p>
                  </>
                ) : (
                  <p className="text-flowpm-muted">
                    {projectCount} project{projectCount === 1 ? "" : "s"} — no project cap on this plan.
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
                    {seatCount} seat{seatCount === 1 ? "" : "s"} in use — unlimited seats on this plan.
                  </p>
                )}
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            {canManageBilling ? (
              <>
                <Button
                  type="button"
                  className="h-10 w-full bg-flowpm-primary hover:bg-flowpm-primary-hover sm:w-auto"
                  onClick={() => setManageOpen(true)}
                >
                  Manage subscription
                </Button>
                <p className="text-xs text-flowpm-muted">View plans and payment options (card, bKash, Nagad).</p>
              </>
            ) : (
              <p className="text-xs text-flowpm-muted">Only owners and admins can manage billing and upgrades.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <SubscriptionManageModal
        open={manageOpen && canManageBilling}
        onClose={() => setManageOpen(false)}
        plan={plan}
        canManageBilling={canManageBilling}
      />
    </div>
  );
}
