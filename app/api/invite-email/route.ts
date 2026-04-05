import { NextResponse } from "next/server";
import { getFirebaseAdminApp } from "@/lib/firebase/admin";
import { Resend } from "resend";

export const runtime = "nodejs";

function absoluteOrigin(request: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

type Body = {
  orgId?: string;
  token?: string;
  inviteeEmail?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgId = typeof body.orgId === "string" ? body.orgId.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const inviteeEmail = typeof body.inviteeEmail === "string" ? body.inviteeEmail.trim().toLowerCase() : "";

  if (!orgId || !token || !inviteeEmail || !inviteeEmail.includes("@")) {
    return NextResponse.json({ error: "orgId, token, and inviteeEmail are required" }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "Missing Authorization bearer token" }, { status: 401 });
  }

  const app = getFirebaseAdminApp();
  if (!app) {
    return NextResponse.json({
      sent: false,
      reason: "missing_admin",
      message: "Set FIREBASE_SERVICE_ACCOUNT_JSON on the server to verify users and send email.",
    });
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    return NextResponse.json({
      sent: false,
      reason: "missing_resend",
      message: "Set RESEND_API_KEY on the server to send invitation emails.",
    });
  }

  let uid: string;
  try {
    const decoded = await app.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const db = app.firestore();
  const inviteRef = db.collection("organizations").doc(orgId).collection("invites").doc(token);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const inv = inviteSnap.data() as Record<string, unknown>;
  const invEmail = String(inv.email ?? "").toLowerCase();
  if (invEmail !== inviteeEmail) {
    return NextResponse.json({ error: "Email does not match this invite" }, { status: 400 });
  }

  const invitedByUid = String(inv.invitedByUid ?? "");
  const memberSnap = await db.collection("organizations").doc(orgId).collection("members").doc(uid).get();
  const role = (memberSnap.data()?.role as string) || "";
  const canSend = invitedByUid === uid || role === "owner" || role === "admin";
  if (!canSend) {
    return NextResponse.json({ error: "Not allowed to send this invite" }, { status: 403 });
  }

  const organizationName = String(inv.organizationName ?? "Workspace");
  const inviteRole = String(inv.role ?? "member");
  const origin = absoluteOrigin(request);
  const inviteUrl = `${origin}/invite?org=${encodeURIComponent(orgId)}&t=${encodeURIComponent(token)}`;

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "FlowPM <onboarding@resend.dev>";

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from,
    to: [inviteeEmail],
    subject: `You're invited to ${organizationName} on FlowPM`,
    html: `
      <p>Hi,</p>
      <p>You've been invited to join <strong>${escapeHtml(organizationName)}</strong> on FlowPM as <strong>${escapeHtml(inviteRole)}</strong>.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 16px;background:#534ab7;color:#fff;text-decoration:none;border-radius:8px;">Accept invitation</a></p>
      <p style="font-size:13px;color:#666;">Or copy this link:<br/><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p style="font-size:13px;color:#666;">Sign in with this email address: <strong>${escapeHtml(inviteeEmail)}</strong></p>
    `,
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Resend failed" }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
