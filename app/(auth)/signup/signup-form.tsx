"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { createWorkspaceForNewUser } from "@/lib/firebase/create-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const org = (form.elements.namedItem("org") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim().toLowerCase();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    if (name.length < 2 || org.length < 2) {
      setError("Name and organization must be at least 2 characters.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setPending(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await createWorkspaceForNewUser({
        uid: cred.user.uid,
        email,
        displayName: name,
        orgName: org,
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (code === "auth/weak-password") {
        setError("Password is too weak.");
      } else if (code === "auth/invalid-email") {
        setError("Enter a valid email address.");
      } else {
        setError("Could not create account. Try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-flowpm-border shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="font-heading text-2xl text-flowpm-dark">Create workspace</CardTitle>
        <p className="text-sm text-flowpm-muted">Start your agency on FlowPM</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" required minLength={2} autoComplete="name" className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org">Organization name</Label>
            <Input
              id="org"
              name="org"
              required
              minLength={2}
              placeholder="Acme Digital"
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="h-10"
            />
          </div>
          {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
          <Button
            type="submit"
            disabled={pending}
            className="h-10 w-full bg-flowpm-primary hover:bg-flowpm-primary-hover"
          >
            {pending ? "Creating…" : "Create account"}
          </Button>
          <p className="text-center text-sm text-flowpm-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-flowpm-primary hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
