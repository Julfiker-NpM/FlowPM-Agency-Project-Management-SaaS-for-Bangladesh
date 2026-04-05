"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { firestoreToDate } from "@/lib/firebase/firestore-dates";
import { startOfUtcDay } from "@/lib/dates";
import { PageMotion } from "@/components/flowpm/page-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type InvoiceLine = {
  projectId: string;
  projectName: string;
  hours: number;
  rate: number;
  amount: number;
};

export type InvoiceRow = {
  id: string;
  label: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date | null;
  periodLabel: string;
  lineItems: InvoiceLine[];
};

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
}

export function InvoicesClient({ orgId }: { orgId: string }) {
  const db = getFirebaseDb();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "organizations", orgId, "invoices"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: InvoiceRow[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>;
          const lineItems = (x.lineItems as InvoiceLine[] | undefined) ?? [];
          const created = firestoreToDate(x.createdAt);
          const start = firestoreToDate(x.periodStart);
          const end = firestoreToDate(x.periodEnd);
          let periodLabel = "—";
          if (start && end) {
            periodLabel = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
          }
          return {
            id: d.id,
            label: String(x.label ?? `Invoice ${d.id.slice(0, 6)}`),
            status: String(x.status ?? "draft"),
            total: typeof x.total === "number" ? x.total : 0,
            currency: String(x.currency ?? "USD"),
            createdAt: created,
            periodLabel,
            lineItems,
          };
        });
        setInvoices(rows);
        setLoading(false);
      },
      () => {
        setInvoices([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [db, orgId]);

  const generateLast30Days = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const end = new Date();
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 30);
      const startDay = startOfUtcDay(start);
      const endDay = startOfUtcDay(end);

      const [projSnap, timeSnap] = await Promise.all([
        getDocs(collection(db, "organizations", orgId, "projects")),
        getDocs(collection(db, "organizations", orgId, "timeEntries")),
      ]);
      const names = new Map<string, string>();
      projSnap.docs.forEach((d) => {
        names.set(d.id, String((d.data() as Record<string, unknown>).name ?? "Project"));
      });

      const byProject = new Map<string, number>();
      for (const d of timeSnap.docs) {
        const x = d.data() as Record<string, unknown>;
        const dt = firestoreToDate(x.date);
        const h = x.hours as number | undefined;
        if (!dt || typeof h !== "number" || h <= 0) continue;
        if (dt < startDay || dt > endDay) continue;
        const pid = (x.projectId as string | undefined) ?? "";
        const key = pid || "_none";
        byProject.set(key, (byProject.get(key) ?? 0) + h);
      }

      const rate = Math.max(1, hourlyRate);
      const lineItems: InvoiceLine[] = [];
      let subtotal = 0;
      for (const [pid, hours] of Array.from(byProject.entries())) {
        const amount = Math.round(hours * rate * 100) / 100;
        subtotal += amount;
        lineItems.push({
          projectId: pid,
          projectName: pid === "_none" ? "No project" : names.get(pid) ?? "Project",
          hours,
          rate,
          amount,
        });
      }
      lineItems.sort((a, b) => b.hours - a.hours);

      if (lineItems.length === 0) {
        setError("No billable hours in the last 30 days.");
        return;
      }

      await addDoc(collection(db, "organizations", orgId, "invoices"), {
        label: `Invoice ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
        status: "draft",
        currency: "USD",
        hourlyRate: rate,
        lineItems,
        subtotal,
        total: subtotal,
        periodStart: Timestamp.fromDate(startDay),
        periodEnd: Timestamp.fromDate(endDay),
        createdAt: serverTimestamp(),
      });
    } catch {
      setError("Could not create invoice.");
    } finally {
      setBusy(false);
    }
  }, [db, orgId, hourlyRate]);

  const printInvoice = invoices.find((i) => i.id === printId);

  return (
    <PageMotion>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-flowpm-dark">Invoices</h2>
          <p className="mt-1 text-sm text-flowpm-muted">
            Draft invoices from tracked time (last 30 days). Mark sent or paid; use Print for PDF via your browser.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="inv-rate" className="text-xs">
              Default rate (USD/hr)
            </Label>
            <Input
              id="inv-rate"
              type="number"
              min={1}
              className="h-9 w-28"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value) || 1)}
            />
          </div>
          <Button
            type="button"
            className="bg-flowpm-primary hover:bg-flowpm-primary-hover"
            disabled={busy}
            onClick={() => void generateLast30Days()}
          >
            {busy ? "Working…" : "New from last 30 days"}
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-flowpm-danger">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-flowpm-muted">Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <Card className="border-flowpm-border">
          <CardContent className="p-6 text-sm text-flowpm-muted">No invoices yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => (
            <Card key={inv.id} className="border-flowpm-border shadow-card">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="font-heading text-base">{inv.label}</CardTitle>
                  <p className="mt-1 text-xs text-flowpm-muted">{inv.periodLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="capitalize">
                    {inv.status}
                  </Badge>
                  <span className="text-sm font-semibold text-flowpm-body">
                    {formatMoney(inv.total, inv.currency)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="overflow-x-auto text-sm">
                  <table className="w-full min-w-[400px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-flowpm-border text-flowpm-muted">
                        <th className="py-2 pr-2 font-medium">Project</th>
                        <th className="py-2 pr-2 font-medium">Hours</th>
                        <th className="py-2 pr-2 font-medium">Rate</th>
                        <th className="py-2 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.lineItems.map((line, idx) => (
                        <tr key={`${line.projectId}-${idx}`} className="border-b border-flowpm-border/60">
                          <td className="py-2 pr-2 text-flowpm-body">{line.projectName}</td>
                          <td className="py-2 pr-2 tabular-nums text-flowpm-muted">{line.hours}</td>
                          <td className="py-2 pr-2 tabular-nums text-flowpm-muted">
                            {formatMoney(line.rate, inv.currency)}
                          </td>
                          <td className="py-2 tabular-nums text-flowpm-body">
                            {formatMoney(line.amount, inv.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPrintId(inv.id)}>
                    Print / Save PDF
                  </Button>
                  {inv.status === "draft" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void updateDoc(doc(db, "organizations", orgId, "invoices", inv.id), { status: "sent" })
                      }
                    >
                      Mark sent
                    </Button>
                  ) : null}
                  {inv.status !== "paid" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-flowpm-success text-white hover:opacity-90"
                      onClick={() =>
                        void updateDoc(doc(db, "organizations", orgId, "invoices", inv.id), { status: "paid" })
                      }
                    >
                      Mark paid
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {printInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:static print:bg-transparent print:p-0">
          <div
            className={cn(
              "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-flowpm-border bg-flowpm-surface p-6 shadow-xl",
              "print:max-h-none print:shadow-none print:border-0",
            )}
            id="invoice-print-area"
          >
            <div className="mb-4 flex justify-between gap-4 print:hidden">
              <Button type="button" variant="outline" size="sm" onClick={() => setPrintId(null)}>
                Close
              </Button>
              <Button type="button" size="sm" className="bg-flowpm-primary" onClick={() => window.print()}>
                Print
              </Button>
            </div>
            <h1 className="font-heading text-lg font-bold text-flowpm-dark">FlowPM invoice</h1>
            <p className="mt-1 text-sm text-flowpm-muted">{printInvoice.label}</p>
            <p className="text-xs text-flowpm-muted">{printInvoice.periodLabel}</p>
            <p className="mt-2 text-xs capitalize text-flowpm-muted">Status: {printInvoice.status}</p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-flowpm-muted">
                  <th className="py-2">Project</th>
                  <th className="py-2">Hours</th>
                  <th className="py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {printInvoice.lineItems.map((line, idx) => (
                  <tr key={idx} className="border-b border-flowpm-border/50">
                    <td className="py-2">{line.projectName}</td>
                    <td className="py-2 tabular-nums">{line.hours}</td>
                    <td className="py-2 tabular-nums">{formatMoney(line.amount, printInvoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-right text-base font-semibold">
              Total {formatMoney(printInvoice.total, printInvoice.currency)}
            </p>
          </div>
        </div>
      ) : null}
    </PageMotion>
  );
}
