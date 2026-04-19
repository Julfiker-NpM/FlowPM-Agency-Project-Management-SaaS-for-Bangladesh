import Link from "next/link";
import { PRICING_TIERS } from "@/lib/flowpm/plan-limits";

type PageProps = { searchParams: { plan?: string } };

export default function PayBkashPage({ searchParams }: PageProps) {
  const plan = searchParams.plan === "agency" ? "agency" : "pro";
  const tier = PRICING_TIERS.find((t) => t.id === plan) ?? PRICING_TIERS[1];
  const label = plan === "agency" ? "Ultra" : "Pro";

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-flowpm-body">
      <h1 className="font-heading text-2xl font-semibold text-flowpm-dark">Pay with bKash — {label}</h1>
      <p className="mt-3 text-sm text-flowpm-muted">
        Online checkout for this workspace is not connected yet. To finish your upgrade, send the subscription amount
        via bKash, then contact your workspace owner with the transaction ID so they can confirm your plan.
      </p>
      <p className="mt-4 rounded-lg border border-flowpm-border bg-flowpm-canvas/60 p-4 text-sm">
        <span className="font-medium text-flowpm-dark">Amount (reference):</span> {tier.priceLine}{" "}
        <span className="text-flowpm-muted">{tier.priceSub}</span>
      </p>
      <p className="mt-6 text-sm text-flowpm-muted">
        When your team adds a bKash payment link in hosting settings, the “Pay with bKash” button will open checkout
        automatically.
      </p>
      <Link href="/settings" className="mt-8 inline-flex text-sm font-medium text-flowpm-primary hover:underline">
        ← Back to Settings
      </Link>
    </main>
  );
}
