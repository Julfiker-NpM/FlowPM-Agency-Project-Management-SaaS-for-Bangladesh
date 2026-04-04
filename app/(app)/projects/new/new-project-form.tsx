"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { useFlowAuth } from "@/context/flowpm-auth-context";
import { PageMotion } from "@/components/flowpm/page-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewProjectForm() {
  const router = useRouter();
  const { orgId } = useFlowAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!orgId) {
      setError("No organization.");
      return;
    }
    const oid = orgId;
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const clientName = (form.elements.namedItem("client") as HTMLInputElement).value.trim();
    const dueRaw = (form.elements.namedItem("due") as HTMLInputElement).value.trim();

    if (name.length < 2) {
      setError("Project name is required.");
      return;
    }

    const auth = getFirebaseAuth().currentUser;
    if (!auth) {
      setError("Not signed in.");
      return;
    }

    setPending(true);
    try {
      const db = getFirebaseDb();
      let clientId: string | undefined;
      const clientNameStore: string | null = clientName || null;
      if (clientName) {
        const cref = await addDoc(collection(db, "organizations", oid, "clients"), {
          name: clientName,
          createdAt: serverTimestamp(),
        });
        clientId = cref.id;
      }

      let dueDate: Timestamp | null = null;
      if (dueRaw) {
        const d = new Date(dueRaw);
        if (!Number.isNaN(d.getTime())) dueDate = Timestamp.fromDate(d);
      }

      const pref = await addDoc(collection(db, "organizations", oid, "projects"), {
        name,
        clientId: clientId ?? null,
        clientName: clientNameStore,
        status: "active",
        color: "#534AB7",
        createdBy: auth.uid,
        createdAt: serverTimestamp(),
        dueDate,
        orgId: oid,
      });

      router.replace(`/projects/${pref.id}`);
      router.refresh();
    } catch {
      setError("Could not create project.");
    } finally {
      setPending(false);
    }
  }

  return (
    <PageMotion>
      <Card className="mx-auto max-w-lg border-flowpm-border shadow-card">
        <CardHeader>
          <CardTitle className="font-heading">New project</CardTitle>
          <p className="text-sm text-flowpm-muted">Name, client, and due date.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">
                Project name <span className="text-flowpm-danger">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                className="h-10"
                placeholder="e.g. Acme rebrand"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Input id="client" name="client" className="h-10" placeholder="Company name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Due date</Label>
              <Input id="due" name="due" type="date" className="h-10" />
            </div>
            {error ? <p className="text-xs text-flowpm-danger">{error}</p> : null}
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={pending}
                className="h-10 bg-flowpm-primary hover:bg-flowpm-primary-hover"
              >
                {pending ? "Creating…" : "Create project"}
              </Button>
              <Link
                href="/projects"
                className={cn(buttonVariants({ variant: "outline" }), "inline-flex h-10 items-center px-4")}
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageMotion>
  );
}
