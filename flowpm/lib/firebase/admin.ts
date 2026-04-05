import * as admin from "firebase-admin";

function parseServiceAccount(): admin.ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const projectId = String(j.project_id ?? j.projectId ?? "");
    const clientEmail = String(j.client_email ?? j.clientEmail ?? "");
    let privateKey = String(j.private_key ?? j.privateKey ?? "");
    privateKey = privateKey.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

/** Returns null if FIREBASE_SERVICE_ACCOUNT_JSON is missing or invalid. */
export function getFirebaseAdminApp(): admin.app.App | null {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const cred = parseServiceAccount();
  if (!cred) return null;
  return admin.initializeApp({
    credential: admin.credential.cert(cred),
  });
}
