import { NextRequest, NextResponse } from "next/server";
import { mergeCheckoutBaseWithPlan, serverNagadCheckoutBase } from "@/lib/flowpm/bd-payments";

function origin(req: NextRequest) {
  return req.nextUrl.origin;
}

export function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("plan") ?? "pro";
  const plan = raw === "agency" ? "agency" : "pro";
  const base = serverNagadCheckoutBase();
  const dest = mergeCheckoutBaseWithPlan(base, plan);
  if (dest) return NextResponse.redirect(dest, 302);
  return NextResponse.redirect(new URL(`/pay/nagad?plan=${encodeURIComponent(plan)}`, origin(req)), 302);
}
