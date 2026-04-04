"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value.trim();
    if (!email) {
      setError("Enter your email.");
      return;
    }
    setPending(true);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      setMessage("Check your inbox for a reset link.");
    } catch {
      setError("Could not send email. Check the address and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-flowpm-border shadow-card">
      <CardHeader>
        <CardTitle className="font-heading text-xl">Reset password</CardTitle>
        <p className="text-sm text-flowpm-muted">We&apos;ll email you a reset link.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required className="h-10" />
          </div>
          {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
          {message ? <p className="text-xs text-[#0F6E56]">{message}</p> : null}
          <Button
            type="submit"
            disabled={pending}
            className="h-10 w-full bg-flowpm-primary hover:bg-flowpm-primary-hover"
          >
            {pending ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-flowpm-primary hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
