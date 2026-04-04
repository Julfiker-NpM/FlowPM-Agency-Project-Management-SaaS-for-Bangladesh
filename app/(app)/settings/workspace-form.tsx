"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function WorkspaceForm(props: { orgId: string; orgName: string; plan: string }) {
  const { orgId, orgName, plan } = props;
  const { refreshProfile } = useFlowAuth();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(false);

  const planLabel = plan === "free" ? "Free" : plan === "pro" ? "Pro" : plan;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("orgName") as HTMLInputElement).value.trim();
    if (name.length < 2) {
      setError("Workspace name is required.");
      return;
    }
    setPending(true);
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "organizations", orgId), { name });
      setOk(true);
      await refreshProfile();
    } catch {
      setError("Could not save. You may need owner or admin access.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-flowpm-border shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Workspace name</Label>
              <Input
                id="orgName"
                name="orgName"
                className="h-10"
                defaultValue={orgName}
                required
                minLength={2}
                key={orgName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tz">Timezone</Label>
              <Input id="tz" name="tz" className="h-10" defaultValue="UTC" disabled />
              <p className="text-xs text-flowpm-muted">Timezone selection can be added later.</p>
            </div>
            {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
            {ok ? <p className="text-xs text-[#0F6E56]">Saved.</p> : null}
            <Button
              type="submit"
              disabled={pending}
              className="h-10 bg-flowpm-primary hover:bg-flowpm-primary-hover"
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="border-flowpm-border shadow-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-flowpm-muted">
          <p>
            Plan: <strong className="text-flowpm-body">{planLabel}</strong>
          </p>
          <Separator />
          <p>Stripe billing can connect here when you enable payments.</p>
          <Button variant="outline" className="h-10" type="button" disabled>
            Manage subscription
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
