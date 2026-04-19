/**
 * Optional checkout / payment-page URLs for Bangladesh mobile banking.
 * Point these at your merchant-hosted payment page or gateway redirect until
 * server-side webhooks are implemented.
 */
export function bdBkashCheckoutUrl(): string {
  return typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_BKASH_CHECKOUT_URL?.trim() ?? "") : "";
}

export function bdNagadCheckoutUrl(): string {
  return typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_NAGAD_CHECKOUT_URL?.trim() ?? "") : "";
}

/** Merge merchant checkout base URL with plan (pro | agency). Returns null if base is empty. */
export function mergeCheckoutBaseWithPlan(base: string, plan: string): string | null {
  const b = base.trim();
  if (!b) return null;
  try {
    const u = new URL(b);
    u.searchParams.set("plan", plan);
    return u.toString();
  } catch {
    const join = b.includes("?") ? "&" : "?";
    return `${b}${join}plan=${encodeURIComponent(plan)}`;
  }
}

/** Server routes may read non-public env first, then public (same as client build). */
export function serverBkashCheckoutBase(): string {
  return (process.env.BKASH_CHECKOUT_URL || process.env.NEXT_PUBLIC_BKASH_CHECKOUT_URL || "").trim();
}

export function serverNagadCheckoutBase(): string {
  return (process.env.NAGAD_CHECKOUT_URL || process.env.NEXT_PUBLIC_NAGAD_CHECKOUT_URL || "").trim();
}
