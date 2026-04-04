import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function readConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

let app: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK is browser-only.");
  }
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }
  const c = readConfig();
  if (!c.apiKey || !c.projectId) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_* env vars. Copy .env.example to .env.");
  }
  app = initializeApp(c);
  return app;
}

let cachedAuth: Auth | undefined;
export function getFirebaseAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

let cachedDb: Firestore | undefined;
export function getFirebaseDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(getFirebaseApp());
  return cachedDb;
}
