/**
 * The video pipeline worker (migration 147). Runs in container
 * eac-video-worker, the only place with ffmpeg:
 *
 *   node_modules/.bin/tsx scripts/video-worker.mts          # loop forever
 *   node_modules/.bin/tsx scripts/video-worker.mts --once   # one scan + drain, then exit
 *
 * Every SCAN_MS it looks in each enabled pipeline's drop folder and queues
 * what has settled; between scans it renders queued jobs one at a time —
 * encoding is CPU-bound, and two at once would just take twice as long each
 * while starving the web apps on the same box.
 *
 * Nextcloud has no push for "a file appeared" that the service account can
 * subscribe to without admin rights (webhook_listeners registration is
 * admin-only), so this polls. A PROPFIND of a small folder every minute is
 * nothing next to one encode.
 */

import {
  claimNextVideoJob,
  getVideoPipeline,
  listEnabledVideoPipelines,
  provisionPipelineFolders,
  requeueStaleVideoJobs,
  scanVideoPipeline,
  type DropSightings,
} from '../src/video-pipeline.ts';
import { ffmpegAvailable, processVideoJob } from '../src/video-render.ts';

const SCAN_MS = Number(process.env.VIDEO_SCAN_SECONDS || 60) * 1000;
const once = process.argv.includes('--once');
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

const sightings: DropSightings = new Map();
const provisioned = new Set<string>();
let stopping = false;

async function scanAll(): Promise<void> {
  for (const p of await listEnabledVideoPipelines()) {
    try {
      if (!provisioned.has(p.id)) {
        if (await provisionPipelineFolders(p)) provisioned.add(p.id);
        else log(`[video] could not create folders for ${p.orgId}/${p.folder}`);
      }
      const r = await scanVideoPipeline(p, sightings);
      if (r.queued.length || r.waiting.length) {
        log(`[video] ${p.orgId}/${p.slug}: queued ${JSON.stringify(r.queued)} waiting ${JSON.stringify(r.waiting)}`);
      }
    } catch (err) {
      log(`[video] scan ${p.orgId}/${p.slug} failed:`, err);
    }
  }
}

async function drain(): Promise<void> {
  while (!stopping) {
    const job = await claimNextVideoJob();
    if (!job) return;
    const pipeline = await getVideoPipeline(job.orgId, job.pipelineId);
    if (!pipeline) continue;
    await processVideoJob(job, pipeline, log);
  }
}

async function main() {
  const version = await ffmpegAvailable();
  if (!version) {
    log('[video] ffmpeg not found — this must run in the eac-video-worker container');
    process.exit(1);
  }
  log(`[video] worker up: ${version}; scanning every ${SCAN_MS / 1000}s`);

  // Single worker: anything 'processing' at start was ours and died with us.
  const requeued = await requeueStaleVideoJobs(0);
  if (requeued) log(`[video] requeued ${requeued} interrupted job(s)`);

  for (;;) {
    await scanAll();
    await drain();
    if (once || stopping) break;
    await new Promise((r) => setTimeout(r, SCAN_MS));
    if (stopping) break;
  }
  process.exit(0);
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    // An encode in flight is abandoned; the next start requeues it.
    log(`[video] ${sig} — stopping`);
    stopping = true;
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

main().catch((err) => {
  console.error('[video] fatal:', err);
  process.exit(1);
});
