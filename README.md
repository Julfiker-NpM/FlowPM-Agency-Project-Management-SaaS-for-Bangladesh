# FlowPM

Agency-style project management: **Firebase Authentication** + **Cloud Firestore** (no Prisma/SQLite in this branch).

## Stack

- **Next.js 14** (App Router), **Tailwind**, **shadcn/ui**, **Framer Motion**, **Zustand**
- **Firebase Auth** (email/password)
- **Firestore** with `firestore.rules` (deploy before production)

## Setup

1. Create a **Firebase** project, enable **Authentication** → Email/Password, enable **Firestore** (production mode).
2. Add a **Web app** and copy config into `.env` (see `.env.example`).
3. Deploy rules:

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

4. Install and run:

   ```bash
   cd flowpm
   npm install
   cp .env.example .env
   # fill NEXT_PUBLIC_FIREBASE_* values
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) → **Sign up** creates a user, Firestore `users` doc, `organizations` doc, and `members/{uid}`.

## Data model (Firestore)

- `users/{uid}` — profile + `currentOrgId`
- `organizations/{orgId}` — workspace
- `organizations/{orgId}/members/{uid}` — role, name, email
- `organizations/{orgId}/clients/{clientId}`
- `organizations/{orgId}/projects/{projectId}` + subcollection `tasks/{taskId}`
- `organizations/{orgId}/timeEntries/{entryId}`
- `organizations/{orgId}/taskComments/{commentId}` — optional feed (dashboard)

## Deploy (e.g. Vercel)

Set the same `NEXT_PUBLIC_FIREBASE_*` env vars. Ensure Firestore rules are deployed in Firebase Console.
