"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    setPending(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      const dest = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
      router.replace(dest);
      router.refresh();
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else {
        setError("Could not sign in. Check your credentials and try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-flowpm-border shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="font-heading text-2xl text-flowpm-dark">Welcome back</CardTitle>
        <p className="text-sm text-flowpm-muted">Sign in to FlowPM</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
              autoComplete="current-password"
              className="h-10"
            />
          </div>
          {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
          <Button
            type="submit"
            disabled={pending}
            className="h-10 w-full bg-flowpm-primary hover:bg-flowpm-primary-hover"
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-flowpm-surface px-2 text-xs text-flowpm-muted">
            or
          </span>
        </div>
        <Button variant="outline" type="button" className="h-10 w-full" disabled>
          Continue with Google
        </Button>
        <p className="text-center text-sm text-flowpm-muted">
          <Link href="/forgot-password" className="text-flowpm-primary hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-sm text-flowpm-muted">
          No account?{" "}
          <Link href="/signup" className="font-medium text-flowpm-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
