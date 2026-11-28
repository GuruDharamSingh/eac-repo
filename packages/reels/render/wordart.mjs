// Generated word art in the reel-render worker (migration 301): polls
// wordart_jobs, draws the stored design as one still (src/wordart-still.tsx) and
// files the PNG, with its design as .json beside it, in the job's
// Private/Media/Images/WordArt folder. The app side is
// packages/services/src/wordart-generate.ts.

import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ENTRY = resolve(import.meta.dirname, '../src/wordart-still.tsx');
const FONTS = resolve(import.meta.dirname, '../../../apps/arts-collective/public/fonts/wordart');
// A job's folder is written by the service; checked again here before the service account writes to it.
const FOLDER = /^EAC_Network\/(?:[A-Za-z0-9_-]+|users\/[^/]+)\/Private\/Media\/Images\/WordArt$/;

/** `deps` are the renderer's own modules and the worker's storage helpers (render.mjs). */
export function wordArtWorker({ bundle, ensureBrowser, openBrowser, renderStill, selectComposition, davMkcol, davUpload, workDir }) {
  let bundled = null;
  let tableMissingAt = 0;

  async function getBundle() {
    // Once per process, as for the reel templates: a worker restart picks up edits.
    if (!bundled) {
      await ensureBrowser();
      bundled = await bundle({
        entryPoint: ENTRY,
        publicDir: FONTS,
        webpackOverride: (c) => ({
          ...c,
          resolve: { ...c.resolve, modules: ['/opt/reel/node_modules', 'node_modules'] },
        }),
      });
    }
    return bundled;
  }

  /** Draw a design to `<dir>/<name>.png` and `<name>.json`. */
  async function draw(design, dir, name) {
    const serveUrl = await getBundle();
    const png = join(dir, `${name}.png`);
    let doc = null;
    const onBrowserLog = (l) => {
      if (l.text.startsWith('WORDART_DOC ')) doc = l.text.slice('WORDART_DOC '.length);
    };
    const browser = await openBrowser('chrome');
    try {
      const inputProps = { design };
      const composition = await selectComposition({ serveUrl, id: 'wordart', inputProps, puppeteerInstance: browser });
      await renderStill({ serveUrl, composition, inputProps, output: png, imageFormat: 'png', puppeteerInstance: browser, onBrowserLog });
    } finally {
      await browser.close({ silent: true });
    }
    let sidecar = null;
    if (doc) {
      sidecar = join(dir, `${name}.json`);
      await writeFile(sidecar, doc);
    }
    return { png, sidecar };
  }

  /** Render the oldest queued job. False when there is none. */
  async function take(sql) {
    // Without migration 301 the table is missing: look again once a minute.
    if (Date.now() - tableMissingAt < 60_000) return false;
    let job;
    try {
      [job] = await sql`
        UPDATE wordart_jobs SET status = 'running', started_at = now()
        WHERE id = (
          SELECT id FROM wordart_jobs WHERE status = 'queued'
          ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
        )
        RETURNING *
      `;
    } catch (err) {
      if (err?.code === '42P01') {
        if (!tableMissingAt) console.log('wordart_jobs is missing (migration 301 not applied); checking again every minute');
        tableMissingAt = Date.now();
        return false;
      }
      throw err;
    }
    if (!job) return false;
    const t0 = Date.now();
    const jobDir = join(workDir, `wa-${job.id}`);
    try {
      await mkdir(jobDir, { recursive: true });
      if (!FOLDER.test(job.folder) || job.folder.includes('..')) throw new Error('Refusing that folder');
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
      const name = `wordart-${stamp}-${job.id}`;
      const out = await draw(job.input, jobDir, name);
      const parts = job.folder.split('/');
      for (let i = 1; i <= parts.length; i++) await davMkcol(parts.slice(0, i).join('/'));
      const outPath = `${job.folder}/${name}.png`;
      await davUpload(outPath, out.png, 'image/png');
      if (out.sidecar) await davUpload(`${job.folder}/${name}.json`, out.sidecar, 'application/json');
      const { size } = await stat(out.png);
      await sql`
        UPDATE wordart_jobs SET status = 'done', output_path = ${outPath}, output_bytes = ${size}, finished_at = now()
        WHERE id = ${job.id}
      `;
      console.log(`word art ${job.id} done in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${outPath}`);
    } catch (err) {
      console.error(`word art ${job.id} failed:`, err);
      // The first line only: Chrome's errors carry a stack the person has no use for.
      const message = String(err?.message ?? err).split('\n')[0].slice(0, 300);
      await sql`
        UPDATE wordart_jobs SET status = 'failed', error = ${message}, finished_at = now()
        WHERE id = ${job.id}
      `;
    } finally {
      await rm(jobDir, { recursive: true, force: true });
    }
    return true;
  }

  /** A job left 'running' by a previous process will never finish. */
  async function failInterrupted(sql) {
    await sql`
      UPDATE wordart_jobs SET status = 'failed', error = 'The renderer restarted during this picture', finished_at = now()
      WHERE status = 'running'
    `.catch(() => {});
  }

  return { draw, take, failInterrupted };
}
