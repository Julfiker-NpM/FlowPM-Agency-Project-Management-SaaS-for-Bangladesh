"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { firestoreToDate } from "@/lib/firebase/firestore-dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PortalPayload = {
  projectName: string;
  clientLabel: string;
  projectStatus: string;
  taskCounts: Record<string, number>;
  completionPercent: number;
  updatedAt: Date | null;
};

export function PortalPublicClient({ token }: { token: string }) {
  const [data, setData] = useState<PortalPayload | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      setMissing(true);
      return;
    }
    let cancelled = false;
    async function run() {
      try {
        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, "portalLinks", token));
        if (cancelled) return;
        if (!snap.exists()) {
          setMissing(true);
          setData(null);
          return;
        }
        const x = snap.data() as Record<string, unknown>;
        const tc = (x.taskCounts as Record<string, number> | undefined) ?? {};
        setData({
          projectName: String(x.projectName ?? "Project"),
          clientLabel: String(x.clientLabel ?? ""),
          projectStatus: String(x.projectStatus ?? "—"),
          taskCounts: tc,
          completionPercent: typeof x.completionPercent === "number" ? x.completionPercent : 0,
          updatedAt: firestoreToDate(x.updatedAt),
        });
        setMissing(false);
      } catch {
        if (!cancelled) {
          setMissing(true);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-flowpm-canvas px-4 text-sm text-flowpm-muted">
        Loading…
      </div>
    );
  }

  if (missing || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-flowpm-canvas px-4">
        <Card className="w-full max-w-md border-flowpm-border">
          <CardHeader>
            <CardTitle className="font-heading text-base">Link unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-flowpm-muted">
            This client portal link is invalid or has been revoked. Ask your agency for a new link.
          </CardContent>
        </Card>
      </div>
    );
  }

  const order = ["todo", "in_progress", "review", "done"] as const;
  const labels: Record<string, string> = {
    todo: "Todo",
    in_progress: "In progress",
    review: "Review",
    done: "Done",
  };

  return (
    <div className="min-h-screen bg-flowpm-canvas px-4 py-10">
      <div className="mx-auto max-w-lg">
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-flowpm-muted">
          Shared project view · read only
        </p>
        <Card className="border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-xl text-flowpm-dark">{data.projectName}</CardTitle>
            <p className="text-sm text-flowpm-muted">{data.clientLabel || "Client project"}</p>
            <p className="mt-2 text-xs capitalize text-flowpm-muted">Status: {data.projectStatus}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-flowpm-muted">Overall completion</p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-flowpm-canvas">
                <div
                  className="h-full rounded-full bg-flowpm-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, data.completionPercent))}%` }}
                />
              </div>
              <p className="mt-1 text-sm font-medium text-flowpm-body">{data.completionPercent}% done</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-flowpm-muted">Tasks by column</p>
              <ul className="space-y-2 text-sm">
                {order.map((k) => (
                  <li key={k} className="flex justify-between border-b border-flowpm-border/60 py-1">
                    <span className="text-flowpm-body">{labels[k] ?? k}</span>
                    <span className="tabular-nums text-flowpm-muted">{data.taskCounts[k] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </div>
            {data.updatedAt ? (
              <p className="text-[11px] text-flowpm-muted">Last updated {data.updatedAt.toLocaleString()}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
