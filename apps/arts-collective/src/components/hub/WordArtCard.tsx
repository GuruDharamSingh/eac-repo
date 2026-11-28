"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { WordArtJob, WordArtTarget } from "@elkdonis/services/wordart-generate";

/**
 * The hub's "Generate random word art" card: type the words, get a picture in a
 * random font and colours (any part can be pinned), saved to your own files or
 * your org's. Talks to /api/wordart/generate; the reel-render worker draws it.
 */

interface Options {
  targets: WordArtTarget[];
  fonts: Array<{ id: string; label: string }>;
  looks: Array<{ id: string; label: string }>;
  frames: string[];
  jobs: WordArtJob[];
}

const ENDPOINT = "/api/wordart/generate";
const POLL_MS = 2000;
/** After this long a job is still worth showing, but is no longer polled. */
const POLL_FOR_MS = 15 * 60_000;
const FIELD = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

const pending = (j: WordArtJob) => j.status === "queued" || j.status === "running";

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "Word art is not available right now.");
  return body;
}

export function WordArtCard({ orgId }: { orgId: string }) {
  const [options, setOptions] = React.useState<Options | null>(null);
  const [jobs, setJobs] = React.useState<WordArtJob[]>([]);
  const [target, setTarget] = React.useState("oad");
  const [text, setText] = React.useState("");
  const [font, setFont] = React.useState("");
  const [look, setLook] = React.useState("");
  const [frame, setFrame] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    fetch(ENDPOINT, { cache: "no-store" })
      .then((r) => readJson<Options>(r))
      .then((o) => {
        if (!live) return;
        setOptions(o);
        setJobs(o.jobs);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  // the org the console is showing, when this person may save to it; otherwise their own files
  React.useEffect(() => {
    if (options) setTarget(options.targets.some((t) => t.orgId === orgId) ? orgId : "oad");
  }, [options, orgId]);

  // ask after unfinished pictures until they are done
  React.useEffect(() => {
    const waiting = jobs.filter((j) => pending(j) && Date.now() - Date.parse(j.createdAt) < POLL_FOR_MS);
    if (!waiting.length) return;
    let live = true;
    const timer = setTimeout(async () => {
      const fresh = await Promise.all(
        waiting.map((j) =>
          fetch(`${ENDPOINT}/${j.id}`, { cache: "no-store" })
            .then((r) => readJson<{ job: WordArtJob }>(r))
            .then((b) => b.job)
            .catch(() => j),
        ),
      );
      if (!live) return;
      setJobs((list) => list.map((j) => fresh.find((f) => f.id === j.id) ?? j));
      setTick((n) => n + 1);
    }, POLL_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [jobs, tick]);

  async function generate(request: { orgId: string; text: string; pins: Record<string, string> }) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const { job } = await readJson<{ job: WordArtJob }>(res);
      setJobs((list) => [job, ...list].slice(0, 12));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setSending(false);
    }
  }

  const nameOf = (id: string) => options?.targets.find((t) => t.orgId === id)?.name ?? id;

  return (
    <section aria-labelledby="ekh-wordart" className="mb-10 space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1">
        <h2 id="ekh-wordart" className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Word art
        </h2>
        <p className="text-sm text-muted-foreground">
          Type a few words and get a picture in a random type and colour pair, 16:9 unless you choose another frame.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void generate({ orgId: target, text, pins: { font, look, frame } });
        }}
      >
        <label className="block space-y-1 text-sm">
          <span>Words</span>
          <textarea
            className={FIELD}
            rows={2}
            maxLength={120}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Friday Night Open Studio (a new line stays a new line)"
          />
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1 text-sm">
            <span>Save to</span>
            <select className={FIELD} value={target} onChange={(e) => setTarget(e.target.value)} disabled={!options}>
              {(options?.targets ?? [{ orgId: "oad", name: "Just me" }]).map((t) => (
                <option key={t.orgId} value={t.orgId}>{t.name}</option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm" disabled={!options || sending || !text.trim()}>
            {sending ? "Sending…" : "Generate random word art"}
          </Button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Choose parts</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span>Type</span>
              <select className={FIELD} value={font} onChange={(e) => setFont(e.target.value)}>
                <option value="">Random</option>
                {options?.fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span>Colours</span>
              <select className={FIELD} value={look} onChange={(e) => setLook(e.target.value)}>
                <option value="">Random</option>
                {options?.looks.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span>Frame</span>
              <select className={FIELD} value={frame} onChange={(e) => setFrame(e.target.value)}>
                <option value="">16:9</option>
                {options?.frames.filter((f) => f !== "16:9").map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          </div>
        </details>
      </form>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {jobs.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => (
            <li key={j.id} className="space-y-1 text-xs text-muted-foreground">
              {j.url ? (
                <a href={j.url} target="_blank" rel="noopener" className="flex aspect-video items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${j.url}?w=640`} alt={j.text} loading="lazy" className="max-h-full max-w-full object-contain" />
                </a>
              ) : (
                <div role="status" className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border p-3 text-center">
                  {j.status === "failed" ? (j.error ?? "That picture failed.") : j.status === "running" ? "Drawing…" : "Waiting for the renderer…"}
                </div>
              )}
              <p className="truncate text-foreground">{j.text.replace(/\n/g, " ")}</p>
              <p className="flex flex-wrap gap-x-3">
                <span>{nameOf(j.orgId)}</span>
                {j.url && <a href={j.url} download className="underline underline-offset-4">Download</a>}
                <button
                  type="button"
                  className="underline underline-offset-4"
                  disabled={sending}
                  onClick={() => void generate({ orgId: j.orgId, text: j.text, pins: j.frame === "16:9" ? {} : { frame: j.frame } })}
                >
                  Another
                </button>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
