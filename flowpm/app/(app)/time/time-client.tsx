"use client";

import { useEffect, useState } from "react";
import { Timestamp, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { startOfUtcDay } from "@/lib/dates";
import { PageMotion } from "@/components/flowpm/page-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export type ProjectOption = { id: string; name: string };

export type TimeEntryRow = {
  id: string;
  hours: number;
  description: string | null;
  projectName: string;
  dateLabel: string;
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ss = s % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

export function TimeClient(props: {
  orgId: string;
  userId: string;
  todayEntries: TimeEntryRow[];
  weekHours: number;
  projects: ProjectOption[];
  onEntrySaved: () => void;
}) {
  const { orgId, userId, todayEntries, weekHours, projects, onEntrySaved } = props;
  const weekLabel = weekHours % 1 === 0 ? String(weekHours) : weekHours.toFixed(1);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsedMs = startedAt != null ? Date.now() - startedAt : 0;
  void tick;

  async function stopAndSave() {
    if (startedAt == null || !userId) return;
    const ms = Date.now() - startedAt;
    const rawHours = ms / 3_600_000;
    const hours = Math.max(0.02, Math.round(rawHours * 100) / 100);
    if (ms < 30_000) {
      setError("Run the timer for at least 30 seconds before saving.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const db = getFirebaseDb();
      const day = startOfUtcDay(new Date());
      await addDoc(collection(db, "organizations", orgId, "timeEntries"), {
        userId,
        hours,
        description: description.trim() || "",
        projectId: projectId || null,
        date: Timestamp.fromDate(day),
        createdAt: serverTimestamp(),
      });
      setStartedAt(null);
      setDescription("");
      setProjectId("");
      onEntrySaved();
    } catch {
      setError("Could not save time entry. Check your connection and permissions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageMotion>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-flowpm-muted">
          Start a timer, then stop to log time for today (UTC day). Optional project and note.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {startedAt != null ? (
            <>
              <span className="min-w-[5rem] font-mono text-sm tabular-nums text-flowpm-body">
                {formatElapsed(elapsedMs)}
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-10 border-flowpm-border"
                disabled={saving}
                onClick={() => {
                  setStartedAt(null);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-10 bg-flowpm-primary hover:bg-flowpm-primary-hover"
                disabled={saving}
                onClick={() => void stopAndSave()}
              >
                {saving ? "Saving…" : "Stop & save"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="h-10 bg-flowpm-primary hover:bg-flowpm-primary-hover"
              onClick={() => {
                setError(null);
                setStartedAt(Date.now());
              }}
            >
              Start timer
            </Button>
          )}
        </div>
      </div>

      {startedAt != null ? (
        <Card className="mb-6 border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-base">Log details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="time-desc">Description (optional)</Label>
              <Input
                id="time-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you work on?"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="time-project">Project (optional)</Label>
              <select
                id="time-project"
                className="flex h-10 w-full max-w-md rounded-md border border-flowpm-border bg-flowpm-surface px-3 text-sm text-flowpm-body"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">— None —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="mb-4 text-xs text-flowpm-danger">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {todayEntries.length === 0 ? (
              <p className="text-flowpm-muted">No time entries for today yet.</p>
            ) : (
              <ul className="space-y-3">
                {todayEntries.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-flowpm-border pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-flowpm-body">{e.projectName}</p>
                      <p className="text-xs text-flowpm-muted">
                        {e.description || "No description"} · {e.dateLabel}
                      </p>
                    </div>
                    <span className="text-flowpm-body tabular-nums">
                      {e.hours % 1 === 0 ? e.hours : e.hours.toFixed(1)}h
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="border-flowpm-border shadow-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg">This week (you)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-flowpm-muted">
            <p>
              Total: <strong className="text-flowpm-body">{weekLabel}h</strong> logged in the last 7 days (your
              entries only).
            </p>
          </CardContent>
        </Card>
      </div>
    </PageMotion>
  );
}
