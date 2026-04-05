"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRedirectResult, signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signInWithGooglePopupOrRedirect } from "@/lib/firebase/google-sign-in";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const dest = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
    void (async () => {
      try {
        const auth = getFirebaseAuth();
        const result = await getRedirectResult(auth);
        if (cancelled || !result?.user) return;
        router.replace(dest);
        router.refresh();
      } catch {
        /* invalid/expired redirect state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  function googleErrorMessage(err: unknown): string {
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "auth/popup-closed-by-user") return "";
    if (code === "auth/popup-blocked") {
      return "Pop-up was blocked. Allow pop-ups for this site or try again.";
    }
    if (code === "auth/account-exists-with-different-credential") {
      return "This email is already registered with another sign-in method. Use email and password.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not allowed. In Firebase Console → Authentication → Settings, add your site under Authorized domains.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Google sign-in is not enabled in Firebase (Authentication → Sign-in method).";
    }
    return "Could not sign in with Google. Try again.";
  }

  async function onGoogleSignIn() {
    setError(null);
    setGooglePending(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithGooglePopupOrRedirect(auth);
      const dest = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
      router.replace(dest);
      router.refresh();
    } catch (err: unknown) {
      const msg = googleErrorMessage(err);
      if (msg) setError(msg);
    } finally {
      setGooglePending(false);
    }
  }

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
          <Button
            type="submit"
            disabled={pending || googlePending}
            className="h-10 w-full bg-flowpm-primary hover:bg-flowpm-primary-hover"
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-flowpm-surface px-2 text-xs text-flowpm-muted">
            or
          </span>
        </div>
        <Button
          variant="outline"
          type="button"
          className="h-10 w-full border-flowpm-border text-flowpm-dark hover:bg-flowpm-muted/40"
          disabled={pending || googlePending}
          onClick={() => void onGoogleSignIn()}
        >
          {googlePending ? "Connecting…" : "Continue with Google"}
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
