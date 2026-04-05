/** Free plan caps (enforced in UI; align with future Stripe / billing). */
export const FREE_PLAN_MAX_PROJECTS = 10;
export const FREE_PLAN_MAX_MEMBERS = 15;

export type PlanLimitInfo = {
  maxProjects: number | null;
  maxMembers: number | null;
};

export function isFreePlan(plan: string | null | undefined): boolean {
  const p = String(plan ?? "free").toLowerCase();
  return p === "free" || p === "";
}

/** Paid tiers: no hard caps in UI (billing / fair use can apply later). */
export function isProPlan(plan: string | null | undefined): boolean {
  const p = String(plan ?? "").toLowerCase();
  return p === "pro" || p === "business" || p === "team" || p === "enterprise";
}

export function planDisplayLabel(plan: string | null | undefined): string {
  const raw = String(plan ?? "free").trim();
  const p = raw.toLowerCase();
  if (p === "" || p === "free") return "Free";
  if (p === "pro") return "Pro";
  if (p === "business") return "Business";
  if (p === "team") return "Team";
  if (p === "enterprise") return "Enterprise";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function getPlanLimits(plan: string | null | undefined): PlanLimitInfo {
  if (isProPlan(plan)) return { maxProjects: null, maxMembers: null };
  return { maxProjects: FREE_PLAN_MAX_PROJECTS, maxMembers: FREE_PLAN_MAX_MEMBERS };
}

export function freePlanProjectLimitMessage(limit: number): string {
  return `Free plan is limited to ${limit} projects. Upgrade under Settings → Subscription, or archive old projects.`;
}

export function freePlanMemberLimitMessage(limit: number): string {
  return `Free plan is limited to ${limit} workspace members. Upgrade under Settings → Subscription when you need more seats.`;
}

export function subscriptionUpgradeHint(): string {
  return "Online checkout is not connected yet. Use Manage subscription when Stripe is configured, or contact support to upgrade.";
}
