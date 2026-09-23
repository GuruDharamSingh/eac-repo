"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type {
  VideoJob,
  VideoJobStatus,
  VideoPipelineAsset,
  VideoPipelineSummary,
} from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveVideoJobAction,
  createVideoPipelineAction,
  retryVideoJobAction,
  saveVideoJobAction,
  updateVideoPipelineAction,
} from "@/lib/cms/video-actions";

export interface PipelineView {
  pipeline: VideoPipelineSummary;
  assets: VideoPipelineAsset[];
  jobs: VideoJob[];
}

const STATUS: Record<VideoJobStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "Waiting", variant: "outline" },
  processing: { label: "Editing", variant: "secondary" },
  ready: { label: "Ready to check", variant: "default" },
  approved: { label: "Approved", variant: "secondary" },
  published: { label: "Published", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

/** Seconds → "1:02:03" / "4:05". */
function clock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "";
  const t = Math.max(0, Math.round(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "1:02:03", "4:05", "245" → seconds. Blank → undefined; junk → NaN. */
function parseClock(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const parts = t.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0) || parts.length > 3) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function mediaUrl(path: string | null): string | null {
  return path ? `/api/media/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function VideoPipelinesView({
  pipelines,
  nextcloudUrl,
}: {
  pipelines: PipelineView[];
  nextcloudUrl: string | null;
}) {
  const router = useRouter();
  const busy = pipelines.some((p) => p.jobs.some((j) => j.status === "queued" || j.status === "processing"));

  // Poll while something is moving, so progress and the finished video show
  // up without a reload. Quiet pages don't poll.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [busy, router]);

  return (
    <div className="mt-6 space-y-8">
      {pipelines.map((view) => (
        <PipelineCard key={view.pipeline.id} view={view} nextcloudUrl={nextcloudUrl} />
      ))}
      <NewPipelineForm />
    </div>
  );
}

function PipelineCard({ view, nextcloudUrl }: { view: PipelineView; nextcloudUrl: string | null }) {
  const { pipeline, assets, jobs } = view;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const s = pipeline.settings;
  const [trimSilence, setTrimSilence] = useState(s.trimSilence);
  const [silenceDb, setSilenceDb] = useState(String(s.silenceDb));
  const [loudnorm, setLoudnorm] = useState(s.loudnorm);
  const [maxHeight, setMaxHeight] = useState(String(s.maxHeight));

  const role = (r: VideoPipelineAsset["role"]) => assets.find((a) => a.role === r);
  const folderUrl = nextcloudUrl
    ? `${nextcloudUrl}/apps/files/files?dir=${encodeURIComponent(`/${pipeline.path}`)}`
    : null;

  function save(patch: Parameters<typeof updateVideoPipelineAction>[1]) {
    startTransition(async () => {
      const res = await updateVideoPipelineAction(pipeline.id, patch);
      if (!res.ok) toast.error(res.error ?? "Could not save.");
      else toast.success("Saved.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl">{pipeline.name}</h3>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {pipeline.path.split("/").join(" › ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!pipeline.enabled && <Badge variant="outline">Paused</Badge>}
            {folderUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={folderUrl} target="_blank" rel="noreferrer">
                  Open folder in Nextcloud
                </a>
              </Button>
            )}
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Intro</dt>
            <dd>{role("intro")?.name ?? "none"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Outro</dt>
            <dd>{role("outro")?.name ?? "none"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last checked the folder</dt>
            <dd>{ago(pipeline.lastScannedAt)}</dd>
          </div>
        </dl>
        {(!role("intro") || !role("outro")) && (
          <p className="text-xs text-muted-foreground">
            To add an intro or outro, put a file named <code>intro.mp4</code> /{" "}
            <code>outro.mp4</code> (or a still image, <code>.png</code>/<code>.jpg</code>) in the
            folder&apos;s <em>Intro and outro</em>.
          </p>
        )}

        <details className="rounded-md border border-border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Settings</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={trimSilence} onChange={(e) => setTrimSilence(e.target.checked)} />
              Cut silence from the start and end
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={loudnorm} onChange={(e) => setLoudnorm(e.target.checked)} />
              Even out the volume
            </label>
            <div className="space-y-1">
              <Label htmlFor={`db-${pipeline.id}`}>Counts as silence below (dB)</Label>
              <Input
                id={`db-${pipeline.id}`}
                type="number"
                min={-80}
                max={-10}
                value={silenceDb}
                onChange={(e) => setSilenceDb(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Lower (e.g. −55) if it cuts quiet speech; higher (e.g. −35) for a noisy room.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`h-${pipeline.id}`}>Largest size</Label>
              <select
                id={`h-${pipeline.id}`}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3"
                value={maxHeight}
                onChange={(e) => setMaxHeight(e.target.value)}
              >
                <option value="720">720p</option>
                <option value="1080">1080p</option>
                <option value="1440">1440p</option>
                <option value="2160">4K</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                save({ settings: { trimSilence, loudnorm, silenceDb: Number(silenceDb), maxHeight: Number(maxHeight) } })
              }
            >
              Save settings
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => save({ enabled: !pipeline.enabled })}>
              {pipeline.enabled ? "Pause this pipeline" : "Resume this pipeline"}
            </Button>
          </div>
        </details>

        <div>
          <h4 className="text-sm font-medium">Recordings</h4>
          {jobs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing yet. Drop a recording into <em>1 Drop recordings here</em>.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function JobRow({ job }: { job: VideoJob }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(job.title ?? "");
  const [description, setDescription] = useState(job.description ?? "");
  const [trimStart, setTrimStart] = useState(
    job.editOverride.trimStart != null ? clock(job.editOverride.trimStart) : ""
  );
  const [trimEnd, setTrimEnd] = useState(job.editOverride.trimEnd != null ? clock(job.editOverride.trimEnd) : "");
  const [skipIntro, setSkipIntro] = useState(Boolean(job.editOverride.skipIntro));
  const [skipOutro, setSkipOutro] = useState(Boolean(job.editOverride.skipOutro));

  const st = STATUS[job.status];
  const video = mediaUrl(job.outputPath);
  const poster = mediaUrl(job.thumbnailPath);
  const working = job.status === "queued" || job.status === "processing";
  const canRender = job.status === "ready" || job.status === "failed" || job.status === "approved";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      else toast.success(success);
      router.refresh();
    });
  }

  function saveReview(rerender: boolean) {
    const start = parseClock(trimStart);
    const end = parseClock(trimEnd);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      toast.error("Write times as minutes:seconds, like 2:30 or 1:04:10.");
      return;
    }
    run(
      () =>
        saveVideoJobAction(
          job.id,
          { title, description, override: { trimStart: start, trimEnd: end, skipIntro, skipOutro } },
          rerender
        ),
      rerender ? "Saved — editing it again now." : "Saved."
    );
  }

  return (
    <li className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{job.title || job.sourceName}</p>
          <p className="text-xs text-muted-foreground">
            {job.sourceName} · dropped {ago(job.createdAt)}
            {job.probe ? ` · ${clock(job.probe.durationSec)} long` : ""}
            {job.autoEdit ? ` → ${clock(job.autoEdit.outDurationSec)} edited` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={st.variant}>{st.label}</Badge>
          {!working && (
            <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
              {open ? "Close" : "Review"}
            </Button>
          )}
        </div>
      </div>

      {job.status === "processing" && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-label="Progress">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(job.progress * 100)}%` }} />
        </div>
      )}
      {job.status === "failed" && job.error && (
        <p className="mt-3 whitespace-pre-wrap break-words text-xs text-destructive">{job.error.slice(0, 600)}</p>
      )}
      {job.autoEdit && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {job.autoEdit.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          {video && job.status !== "failed" && (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- meeting recordings have no caption track yet
            <video
              key={`${video}-${job.updatedAt}`}
              src={video}
              poster={poster ?? undefined}
              controls
              preload="metadata"
              className="aspect-video w-full rounded-md bg-black"
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`t-${job.id}`}>Title</Label>
              <Input id={`t-${job.id}`} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`d-${job.id}`}>Description</Label>
              <Textarea
                id={`d-${job.id}`}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`s-${job.id}`}>Start the recording at</Label>
              <Input
                id={`s-${job.id}`}
                placeholder={job.autoEdit ? `automatic: ${clock(job.autoEdit.trimStart)}` : "m:ss"}
                value={trimStart}
                onChange={(e) => setTrimStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`e-${job.id}`}>End it at</Label>
              <Input
                id={`e-${job.id}`}
                placeholder={job.autoEdit ? `automatic: ${clock(job.autoEdit.trimEnd)}` : "m:ss"}
                value={trimEnd}
                onChange={(e) => setTrimEnd(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Times are in the original recording ({clock(job.probe?.durationSec)} long). Leave blank to let the
              automatic edit decide.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipIntro} onChange={(e) => setSkipIntro(e.target.checked)} />
              No intro on this one
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipOutro} onChange={(e) => setSkipOutro(e.target.checked)} />
              No outro on this one
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => saveReview(false)}>
              Save details
            </Button>
            {canRender && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => saveReview(true)}>
                Save and edit again
              </Button>
            )}
            {job.status === "failed" && (
              <Button size="sm" disabled={pending} onClick={() => run(() => retryVideoJobAction(job.id), "Trying again.")}>
                Try again
              </Button>
            )}
            {job.status === "ready" && (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => approveVideoJobAction(job.id), "Approved.")}
              >
                Approve for publishing
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function NewPipelineForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function create() {
    startTransition(async () => {
      const res = await createVideoPipelineAction(name);
      if (!res.ok) {
        toast.error(res.error ?? "Could not create it.");
        return;
      }
      toast.success("Pipeline created — its folders are in Nextcloud now.");
      setName("");
      router.refresh();
    });
  }

  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-6">
        <h3 className="font-serif text-lg">Add a pipeline</h3>
        <p className="text-sm text-muted-foreground">
          Each pipeline is its own folder with its own intro and outro — say, one for meeting
          recordings and one for workshop sessions.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-sm"
            placeholder="Workshop sessions"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <Button disabled={pending || !name.trim()} onClick={create}>
            Create
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
