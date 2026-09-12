"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ChartResult } from "@elkdonis/astro";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBase } from "@/lib/base-path";
import { ChartForm, EMPTY_FORM, type ChartFormValues } from "@/components/chart-form";
import { ChartView } from "@/components/chart/chart-view";

// The last form input survives a trip through /login, so signing in doesn't
// mean typing the birth data again. Per-tab, never sent anywhere.
const DRAFT_KEY = "elastrocal:calculator";

function readDraft(): ChartFormValues | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_FORM, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function toPayload(v: ChartFormValues) {
  return {
    date: v.date,
    time: v.timeKnown ? v.time : "12:00",
    timeKnown: v.timeKnown,
    timezone: v.timezone.trim(),
    latitude: Number(v.latitude),
    longitude: Number(v.longitude),
    houseSystem: v.houseSystem,
    locationName: v.locationName.trim() || undefined,
  };
}

export function Calculator({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [initial, setInitial] = useState<ChartFormValues | null>(null);
  const [values, setValues] = useState<ChartFormValues | null>(null);
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function calculate(v: ChartFormValues) {
    setBusy(true);
    setError(null);
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v));
    } catch {
      /* storage unavailable — fine */
    }
    try {
      const res = await fetch(withBase("/api/charts/calculate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(v)),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Calculation failed");
      setValues(v);
      setChart(body.chart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed");
    } finally {
      setBusy(false);
    }
  }

  // Restore a draft (and recalculate it) after returning from sign-in. Runs
  // once on mount; sessionStorage doesn't exist during server rendering.
  useEffect(() => {
    const draft = readDraft();
    setInitial(draft ?? EMPTY_FORM);
    if (draft && draft.date && (draft.time || !draft.timeKnown) && draft.timezone) calculate(draft);
  }, []);

  // Saving needs no account: a signed-out browser is given a guest cookie by
  // the API and its charts live under that until it signs in.
  async function save(isFavorite: boolean) {
    if (!values) return;
    setSaving(true);
    try {
      const res = await fetch(withBase("/api/charts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toPayload(values), name: name.trim(), isFavorite }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      toast.success(body.keeper === "guest" ? "Chart saved to this browser" : "Chart saved");
      router.push(`/charts/${body.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-sm lg:sticky lg:top-24">
        <h2 className="mb-5 text-xl font-semibold">Birth data</h2>
        {initial ? <ChartForm initial={initial} busy={busy} onSubmit={calculate} /> : <div className="h-96" />}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </aside>

      <div>
        {chart ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(false);
                }}
              >
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="chart-name">Save to your charts</Label>
                  <Input
                    id="chart-name"
                    required
                    maxLength={200}
                    placeholder="Whose chart is this?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || !name.trim()}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" disabled={saving || !name.trim()} onClick={() => save(true)}>
                    <Star className="size-4" /> Save as favourite
                  </Button>
                </div>
              </form>
              {!signedIn && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Saved charts stay in this browser.{" "}
                  <Link href="/login?next=/calculate" className="text-primary underline underline-offset-4">
                    Sign in
                  </Link>{" "}
                  to keep them across devices — your birth data will still be here when you come back.
                </p>
              )}
            </div>
            <ChartView chart={chart} />
          </div>
        ) : (
          <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-display text-2xl">Your chart appears here</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Enter the date, local time and place of birth. Search for the place to fill in coordinates and time zone
              automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
