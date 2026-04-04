import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { slugify } from "@/lib/slug";

export async function createWorkspaceForNewUser(input: {
  uid: string;
  email: string;
  displayName: string;
  orgName: string;
}): Promise<string> {
  const db = getFirebaseDb();
  const orgRef = doc(collection(db, "organizations"));
  const slug = `${slugify(input.orgName)}-${Math.random().toString(36).slice(2, 8)}`;
  const batch = writeBatch(db);

  batch.set(doc(db, "users", input.uid), {
    email: input.email,
    name: input.displayName,
    currentOrgId: orgRef.id,
    createdAt: serverTimestamp(),
  });

  batch.set(orgRef, {
    name: input.orgName,
    slug,
    ownerId: input.uid,
    plan: "free",
    createdAt: serverTimestamp(),
  });

  batch.set(doc(db, "organizations", orgRef.id, "members", input.uid), {
    role: "owner",
    email: input.email,
    name: input.displayName,
    joinedAt: serverTimestamp(),
  });

  await batch.commit();
  return orgRef.id;
}
