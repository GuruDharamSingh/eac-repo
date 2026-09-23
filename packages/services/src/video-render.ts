/**
 * The ffmpeg half of video pipelines — WORKER ONLY.
 *
 * Deliberately not exported from the services barrel: it spawns ffmpeg and
 * writes gigabytes to local disk, and nothing in a web request should do
 * either. Import it as `@elkdonis/services/video-render` from the worker
 * (scripts/video-worker.mts), which runs in its own container with ffmpeg.
 *
 * The edit, in order:
 *   1. ffprobe the recording.
 *   2. silencedetect over the audio only (fast — no video decode) and cut
 *      the dead air off the very start and very end. Only the ends: a pause
 *      in the middle of a meeting is part of the meeting.
 *   3. One ffmpeg pass: [intro] + trimmed recording + [outro], each scaled
 *      and padded to one frame size, 30fps, 48kHz stereo, the recording's
 *      audio loudness-normalised, then concatenated and encoded H.264/AAC
 *      with faststart (streamable, and what YouTube wants).
 *   4. A thumbnail from a tenth of the way into the recording.
 *
 * `planAutoEdit` and `buildRenderArgs` are pure, so the decisions can be
 * tested without ffmpeg or Nextcloud.
 */

import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline as streamPipeline } from 'node:stream/promises';
import { davAuthHeader, davLastModified, davMove, davUrl } from './dav';
import {
  failVideoJob,
  finishVideoJob,
  heartbeatVideoJob,
  listPipelineAssets,
  pipelinePath,
  type MediaKind,
  type PipelineSettings,
  type VideoAutoEdit,
  type VideoEditOverride,
  type VideoJob,
  type VideoPipeline,
  type VideoProbe,
} from './video-pipeline';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const WORK_DIR = process.env.VIDEO_WORK_DIR || join(tmpdir(), 'eac-video');
const THREADS = String(Number(process.env.VIDEO_FFMPEG_THREADS) || 6);
const FPS = 30;

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

function run(
  cmd: string,
  args: string[],
  onStdout?: (chunk: string) => void
): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (c: string) => {
      if (onStdout) onStdout(c);
      else stdout += c;
    });
    // Keep the tail only: a two-hour encode writes megabytes of stderr.
    child.stderr.setEncoding('utf8').on('data', (c: string) => {
      stderr = (stderr + c).slice(-200_000);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stderr, stdout }));
  });
}

export async function ffmpegAvailable(): Promise<string | null> {
  try {
    const { code, stdout } = await run(FFMPEG, ['-hide_banner', '-version']);
    return code === 0 ? stdout.split('\n')[0] : null;
  } catch {
    return null;
  }
}

export async function probeMedia(file: string): Promise<VideoProbe> {
  const { code, stdout, stderr } = await run(FFPROBE, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ]);
  if (code !== 0) throw new Error(`ffprobe could not read the file: ${stderr.trim().slice(-500)}`);
  const info = JSON.parse(stdout);
  const streams: any[] = info.streams ?? [];
  // Cover art in an audio file is a 'video' stream with attached_pic; it is not video.
  const v = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const a = streams.find((s) => s.codec_type === 'audio');
  const rate = v?.avg_frame_rate || v?.r_frame_rate;
  let fps: number | null = null;
  if (rate && rate.includes('/')) {
    const [n, d] = rate.split('/').map(Number);
    if (d) fps = Math.round((n / d) * 100) / 100;
  }
  const duration = Number(info.format?.duration ?? v?.duration ?? a?.duration ?? 0);
  return {
    durationSec: Number.isFinite(duration) ? duration : 0,
    width: v?.width ?? null,
    height: v?.height ?? null,
    fps,
    hasVideo: Boolean(v),
    hasAudio: Boolean(a),
  };
}

export interface Silence {
  start: number;
  /** null: still silent when the file ended. */
  end: number | null;
}

export function parseSilencedetect(stderr: string): Silence[] {
  const out: Silence[] = [];
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) {
      out.push({ start: Math.max(0, Number(s[1])), end: null });
      continue;
    }
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (e && out.length && out[out.length - 1].end === null) out[out.length - 1].end = Number(e[1]);
  }
  return out;
}

export async function detectSilence(file: string, db: number, minSec: number): Promise<Silence[]> {
  const { code, stderr } = await run(FFMPEG, [
    '-hide_banner', '-nostats', '-vn', '-i', file,
    '-af', `silencedetect=noise=${db}dB:d=${minSec}`, '-f', 'null', '-',
  ]);
  if (code !== 0) throw new Error(`silence detection failed: ${stderr.trim().slice(-500)}`);
  return parseSilencedetect(stderr);
}

// ---------------------------------------------------------------------------
// Decisions (pure)
// ---------------------------------------------------------------------------

const fmt = (s: number) => {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/**
 * Where to cut. Conservative on purpose: it only removes silence that touches
 * the very start or the very end, keeps `trimPadSec` of it, and refuses to cut
 * at all if what would remain is under a fifth of the recording (a quiet
 * speaker under the threshold looks exactly like silence).
 */
export function planAutoEdit(
  probe: VideoProbe,
  silences: Silence[],
  settings: PipelineSettings,
  override: VideoEditOverride = {}
): { trimStart: number; trimEnd: number; reasons: string[] } {
  const dur = probe.durationSec;
  const reasons: string[] = [];
  let trimStart = 0;
  let trimEnd = dur;

  if (settings.trimSilence && probe.hasAudio && dur > 0) {
    const lead = silences.find((s) => s.start <= 0.5);
    if (lead) {
      const end = lead.end ?? dur;
      trimStart = Math.max(0, end - settings.trimPadSec);
    }
    const tail = [...silences].reverse().find((s) => s.end === null || s.end >= dur - 0.5);
    if (tail && tail !== lead) trimEnd = Math.min(dur, tail.start + settings.trimPadSec);

    const kept = trimEnd - trimStart;
    if (kept < Math.max(20, dur * 0.2)) {
      reasons.push(
        `Almost all of it read as silence at ${settings.silenceDb} dB, so nothing was cut — the speakers may just be quiet.`
      );
      trimStart = 0;
      trimEnd = dur;
    } else {
      if (trimStart > 0) reasons.push(`Cut ${fmt(trimStart)} of silence from the start.`);
      if (trimEnd < dur) reasons.push(`Cut ${fmt(dur - trimEnd)} of silence from the end.`);
      if (!trimStart && trimEnd === dur) reasons.push('No dead air at either end.');
    }
  } else if (!settings.trimSilence) {
    reasons.push('Silence trimming is off for this pipeline.');
  } else if (!probe.hasAudio) {
    reasons.push('No sound track, so there was no silence to find.');
  }

  if (override.trimStart != null && override.trimStart < dur) {
    trimStart = override.trimStart;
    reasons.push(`Start set by hand to ${fmt(trimStart)}.`);
  }
  if (override.trimEnd != null) {
    trimEnd = Math.min(dur, override.trimEnd);
    reasons.push(`End set by hand to ${fmt(trimEnd)}.`);
  }
  if (trimEnd <= trimStart) {
    reasons.push('The trim points crossed, so the whole recording was kept.');
    trimStart = 0;
    trimEnd = dur;
  }
  return { trimStart, trimEnd, reasons };
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Output frame: the recording's own size, capped at maxHeight, never upscaled. */
export function targetFrame(probe: VideoProbe, maxHeight: number): { w: number; h: number } {
  if (probe.hasVideo && probe.width && probe.height) {
    const h = Math.min(maxHeight, probe.height);
    return { w: even((probe.width * h) / probe.height), h: even(h) };
  }
  const h = Math.min(maxHeight, 1080);
  return { w: even((h * 16) / 9), h: even(h) };
}

export interface RenderSegment {
  file: string;
  kind: MediaKind;
  /** For video/audio: the probe. For images: null. */
  probe: VideoProbe | null;
  /** Seconds to take from the start (main only). */
  from?: number;
  /** Seconds long in the output. */
  duration: number;
  /** Loudness-normalise this segment's audio. */
  loudnorm?: boolean;
  /** Audio-only main: the still shown under it (else black). */
  background?: string | null;
}

/**
 * The single ffmpeg invocation. Every segment becomes one [v][a] pair of the
 * same shape, so the concat filter never has to reconcile formats, and a
 * segment with no picture or no sound gets a generated one.
 */
export function buildRenderArgs(
  segments: RenderSegment[],
  frame: { w: number; h: number },
  settings: PipelineSettings,
  output: string
): string[] {
  const { w, h } = frame;
  const inputs: string[] = [];
  const filters: string[] = [];
  const pairs: string[] = [];
  let idx = 0;
  const addInput = (args: string[]) => {
    inputs.push(...args);
    return idx++;
  };

  segments.forEach((seg, k) => {
    const d = seg.duration.toFixed(3);
    let vIn: number;
    let aIn: number | null = null;

    if (seg.kind === 'image') {
      vIn = addInput(['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', seg.file]);
    } else {
      const trim = seg.from ? ['-ss', seg.from.toFixed(3)] : [];
      const main = addInput([...trim, '-t', d, '-i', seg.file]);
      if (seg.probe?.hasAudio) aIn = main;
      if (seg.probe?.hasVideo) vIn = main;
      else if (seg.background) vIn = addInput(['-loop', '1', '-framerate', String(FPS), '-t', d, '-i', seg.background]);
      else vIn = addInput(['-f', 'lavfi', '-t', d, '-i', `color=c=black:s=${w}x${h}:r=${FPS}`]);
    }
    if (aIn === null) aIn = addInput(['-f', 'lavfi', '-t', d, '-i', 'anullsrc=r=48000:cl=stereo']);

    filters.push(
      `[${vIn}:v:0]scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
        `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${FPS},format=yuv420p,` +
        // Pin every segment to its planned length: a picture that stops
        // early holds its last frame, and a stray long stream is cut, so
        // nothing after it drifts out of sync.
        `tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d},setpts=PTS-STARTPTS[v${k}]`
    );
    const norm = seg.loudnorm && settings.loudnorm ? 'loudnorm=I=-16:TP=-1.5:LRA=11,' : '';
    filters.push(
      `[${aIn}:a:0]${norm}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
        `apad,atrim=duration=${d},asetpts=PTS-STARTPTS[a${k}]`
    );
    pairs.push(`[v${k}][a${k}]`);
  });

  filters.push(`${pairs.join('')}concat=n=${segments.length}:v=1:a=1[vout][aout]`);

  return [
    '-hide_banner', '-nostats', '-y',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(settings.crf), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-movflags', '+faststart',
    '-threads', THREADS,
    '-progress', 'pipe:1',
    output,
  ];
}

// ---------------------------------------------------------------------------
// Nextcloud transfer (streamed — recordings are gigabytes)
// ---------------------------------------------------------------------------

export async function davDownloadToFile(remote: string, local: string): Promise<number> {
  const res = await fetch(davUrl(remote), { headers: { Authorization: davAuthHeader() } });
  if (!res.ok || !res.body) throw new Error(`download ${remote} failed: HTTP ${res.status}`);
  await streamPipeline(Readable.fromWeb(res.body as any), createWriteStream(local));
  return (await stat(local)).size;
}

export async function davUploadFile(local: string, remote: string, contentType: string): Promise<number> {
  const size = (await stat(local)).size;
  const init = {
    method: 'PUT',
    headers: { Authorization: davAuthHeader(), 'Content-Type': contentType, 'Content-Length': String(size) },
    body: Readable.toWeb(createReadStream(local)),
    duplex: 'half',
  } as unknown as Parameters<typeof fetch>[1];
  const res = await fetch(davUrl(remote), init);
  if (!res.ok) throw new Error(`upload ${remote} failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return size;
}

/** `name.ext`, or `name (2).ext` … if taken. */
async function freeName(folder: string, base: string, ext: string): Promise<string> {
  for (let n = 1; n < 100; n++) {
    const path = `${folder}/${base}${n === 1 ? '' : ` (${n})`}${ext}`;
    if (!(await davLastModified(path))) return path;
  }
  return `${folder}/${base} ${Date.now()}${ext}`;
}

/** Move the original somewhere, dodging a name clash. Returns where it ended up. */
async function moveSource(job: VideoJob, folder: string): Promise<string> {
  if (job.sourcePath.startsWith(`${folder}/`)) return job.sourcePath;
  const ext = extname(job.sourceName);
  const target = await freeName(folder, job.sourceName.slice(0, job.sourceName.length - ext.length), ext);
  return (await davMove(job.sourcePath, target)) ? target : job.sourcePath;
}

// ---------------------------------------------------------------------------
// One job, end to end
// ---------------------------------------------------------------------------

export async function processVideoJob(job: VideoJob, pipeline: VideoPipeline, log = console.log): Promise<void> {
  const dir = join(WORK_DIR, job.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const settings = pipeline.settings;

  try {
    // 1. Fetch the recording and the pipeline's intro/outro/background.
    const srcLocal = join(dir, `source${extname(job.sourceName) || '.bin'}`);
    log(`[video] ${job.id} downloading ${job.sourcePath}`);
    await davDownloadToFile(job.sourcePath, srcLocal);
    await heartbeatVideoJob(job.id, 0.02);

    const assets = await listPipelineAssets(pipeline);
    const fetched: Record<string, { file: string; kind: MediaKind; probe: VideoProbe | null; name: string }> = {};
    for (const a of assets) {
      if (a.role === 'intro' && job.editOverride.skipIntro) continue;
      if (a.role === 'outro' && job.editOverride.skipOutro) continue;
      const local = join(dir, `${a.role}${extname(a.name)}`);
      await davDownloadToFile(a.path, local);
      fetched[a.role] = {
        file: local,
        kind: a.kind,
        probe: a.kind === 'image' ? null : await probeMedia(local),
        name: a.name,
      };
    }

    // 2. Look at it, and decide the cut.
    const probe = await probeMedia(srcLocal);
    if (!probe.durationSec) throw new Error('The recording has no length — it may be damaged or still uploading.');
    if (!probe.hasAudio && !probe.hasVideo) throw new Error('No picture or sound found in this file.');
    const silences =
      settings.trimSilence && probe.hasAudio
        ? await detectSilence(srcLocal, settings.silenceDb, settings.minSilenceSec)
        : [];
    const cut = planAutoEdit(probe, silences, settings, job.editOverride);

    const segments: RenderSegment[] = [];
    const segFor = (role: 'intro' | 'outro'): RenderSegment | null => {
      const a = fetched[role];
      if (!a) return null;
      const duration = a.kind === 'image' ? settings.imageIntroSec : a.probe?.durationSec ?? 0;
      return duration > 0 ? { file: a.file, kind: a.kind, probe: a.probe, duration } : null;
    };
    const intro = segFor('intro');
    const outro = segFor('outro');
    if (intro) segments.push(intro);
    segments.push({
      file: srcLocal,
      kind: probe.hasVideo ? 'video' : 'audio',
      probe,
      from: cut.trimStart,
      duration: cut.trimEnd - cut.trimStart,
      loudnorm: true,
      background: fetched.background?.file ?? null,
    });
    if (outro) segments.push(outro);

    const total = segments.reduce((n, s) => n + s.duration, 0);
    const autoEdit: VideoAutoEdit = {
      trimStart: cut.trimStart,
      trimEnd: cut.trimEnd,
      reasons: [
        ...cut.reasons,
        intro ? `Intro: ${fetched.intro.name}.` : job.editOverride.skipIntro ? 'Intro skipped by hand.' : 'No intro file.',
        outro ? `Outro: ${fetched.outro.name}.` : job.editOverride.skipOutro ? 'Outro skipped by hand.' : 'No outro file.',
      ],
      intro: intro ? fetched.intro.name : null,
      outro: outro ? fetched.outro.name : null,
      outDurationSec: total,
    };
    await heartbeatVideoJob(job.id, 0.05, { probe, autoEdit });

    // 3. Render, reporting progress from ffmpeg's -progress stream.
    const outLocal = join(dir, 'out.mp4');
    const frame = targetFrame(probe, settings.maxHeight);
    const args = buildRenderArgs(segments, frame, settings, outLocal);
    log(`[video] ${job.id} rendering ${fmt(total)} at ${frame.w}x${frame.h}`);
    let lastBeat = 0;
    let buf = '';
    const rendered = await run(FFMPEG, args, (chunk) => {
      buf += chunk;
      const m = [...buf.matchAll(/out_time_(?:us|ms)=(\d+)/g)].pop();
      buf = buf.slice(-400);
      const now = Date.now();
      if (m && now - lastBeat > 5000) {
        lastBeat = now;
        const done = Number(m[1]) / 1e6 / total;
        void heartbeatVideoJob(job.id, 0.05 + 0.85 * Math.min(1, done)).catch(() => {});
      }
    });
    if (rendered.code !== 0) throw new Error(`ffmpeg failed: ${rendered.stderr.trim().slice(-1500)}`);

    // 4. Thumbnail from a tenth of the way into the recording proper.
    const thumbLocal = join(dir, 'thumb.jpg');
    const thumbAt = (intro?.duration ?? 0) + Math.min(60, (cut.trimEnd - cut.trimStart) * 0.1);
    const thumb = await run(FFMPEG, [
      '-hide_banner', '-y', '-ss', thumbAt.toFixed(2), '-i', outLocal,
      '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', thumbLocal,
    ]);
    await heartbeatVideoJob(job.id, 0.92);

    // 5. Put it back: edited video + thumbnail into Finished, original into Originals.
    const finished = pipelinePath(pipeline, 'finished');
    const base = (job.title || job.sourceName.replace(/\.[^.]+$/, '')).replace(/[/\\:*?"<>|\0]/g, '_').slice(0, 120);
    const outRemote = job.outputPath ?? (await freeName(finished, base, '.mp4'));
    log(`[video] ${job.id} uploading ${outRemote}`);
    const outBytes = await davUploadFile(outLocal, outRemote, 'video/mp4');
    let thumbRemote: string | null = null;
    if (thumb.code === 0) {
      thumbRemote = outRemote.replace(/\.mp4$/, '.jpg');
      try {
        await davUploadFile(thumbLocal, thumbRemote, 'image/jpeg');
      } catch (err) {
        log(`[video] ${job.id} thumbnail upload failed: ${(err as Error).message}`);
        thumbRemote = null;
      }
    }
    const sourcePath = await moveSource(job, pipelinePath(pipeline, 'originals'));
    await finishVideoJob(job.id, { sourcePath, outputPath: outRemote, thumbnailPath: thumbRemote, outputBytes: outBytes });
    log(`[video] ${job.id} ready (${(outBytes / 1e6).toFixed(1)} MB)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`[video] ${job.id} FAILED: ${message.slice(0, 500)}`);
    let sourcePath: string | undefined;
    try {
      sourcePath = await moveSource(job, pipelinePath(pipeline, 'failed'));
    } catch {
      /* leave it where it is; the job row still says where */
    }
    await failVideoJob(job.id, message, sourcePath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

