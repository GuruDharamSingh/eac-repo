/**
 * Generated word art: the queue and its HTTP routes (migration 301). A request
 * becomes a wordart_jobs row; the reel-render worker draws it
 * (packages/reels/render/wordart.mjs) into the target's
 * Private/Media/Images/WordArt/ folder. The pictures are media assets, not
 * threads.
 *
 * Who may ask: anyone signed in for themselves ('oad', "Just me"); owners and
 * guides for their org. A job is read only by the person who asked for it.
 *
 * Design: docs/open/WORDART_GENERATE_2026-11-27.md.
 */

import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { getProxyFileUrl } from './nextcloud';
import { orgStorageRoot } from './org-storage';
import { registerLibraryItem } from './uploads';
import { getStorageSlug, userStorageRoot } from './user-storage';
import {
  cleanWordArtRequest,
  resolveWordArtDesign,
  type WordArtDesign,
  type WordArtFrame,
} from './wordart-catalog';

const PERSONAL_ORG_ID = 'oad';
/** Per person, per rolling hour. */
export const WORDART_HOURLY_LIMIT = 20;
const FOLDER = 'Private/Media/Images/WordArt';

export type WordArtJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface WordArtJob {
  id: string;
  orgId: string;
  status: WordArtJobStatus;
  text: string;
  look: string;
  frame: WordArtFrame;
  /** Set once done. The URL is the media proxy's: only people who may read the folder get the file. */
  path: string | null;
  url: string | null;
  error: string | null;
  createdAt: string;
}

export interface WordArtTarget {
  orgId: string;
  name: string;
}

interface JobRow {
  id: string;
  org_id: string;
  requested_by: string;
  status: WordArtJobStatus;
  input: WordArtDesign;
  output_path: string | null;
  output_bytes: number | null;
  registered_at: Date | null;
  error: string | null;
  created_at: Date;
}

const toJob = (r: JobRow): WordArtJob => ({
  id: r.id,
  orgId: r.org_id,
  status: r.status,
  text: r.input.text,
  look: r.input.look.id,
  frame: r.input.frame,
  path: r.status === 'done' ? r.output_path : null,
  url: r.status === 'done' && r.output_path ? getProxyFileUrl(r.output_path) : null,
  error: r.status === 'failed' ? r.error : null,
  createdAt: r.created_at.toISOString(),
});

/** Where this person may save generated word art: themselves first, then the orgs they own or guide. */
export async function listWordArtTargets(userId: string): Promise<WordArtTarget[]> {
  const rows = await db<Array<{ id: string; name: string }>>`
    SELECT o.id, o.name
      FROM user_organizations uo
      JOIN organizations o ON o.id = uo.org_id
     WHERE uo.user_id = ${userId} AND uo.role IN ('owner', 'guide') AND uo.org_id <> ${PERSONAL_ORG_ID}
     ORDER BY o.name
  `;
  return [{ orgId: PERSONAL_ORG_ID, name: 'Just me' }, ...rows.map((r) => ({ orgId: r.id, name: r.name }))];
}

export type WordArtQueued =
  | { ok: true; job: WordArtJob }
  | { ok: false; status: 400 | 403 | 409 | 429; error: string };

/** Check a request, resolve its design and queue it. `userId` comes from the session, never from the request. */
export async function queueWordArt(userId: string, raw: unknown): Promise<WordArtQueued> {
  const checked = cleanWordArtRequest(raw);
  if (checked.ok === false) return { ok: false, status: 400, error: checked.error };
  const { orgId } = checked.request;

  const targets = await listWordArtTargets(userId);
  if (!targets.some((t) => t.orgId === orgId)) {
    return { ok: false, status: 403, error: 'Only an owner or guide can make pictures for that organisation' };
  }

  let base: string;
  if (orgId === PERSONAL_ORG_ID) {
    const slug = await getStorageSlug(userId);
    if (!slug) return { ok: false, status: 409, error: 'Your storage folder is not set up yet' };
    base = userStorageRoot(slug);
  } else {
    base = orgStorageRoot(orgId);
  }

  const design = resolveWordArtDesign(checked.request);
  const id = nanoid(12);
  // The count and the insert hold a per-person lock, so parallel requests cannot pass the limit together.
  const row = await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`wordart:${userId}`}))`;
    const [{ n }] = await tx<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM wordart_jobs
       WHERE requested_by = ${userId} AND created_at > now() - interval '1 hour'
    `;
    if (n >= WORDART_HOURLY_LIMIT) return null;
    const [inserted] = await tx<JobRow[]>`
      INSERT INTO wordart_jobs (id, org_id, requested_by, input, folder)
      VALUES (${id}, ${orgId}, ${userId}, ${db.json(design as never)}, ${`${base}/${FOLDER}`})
      RETURNING *
    `;
    return inserted;
  });
  if (!row) return { ok: false, status: 429, error: `At most ${WORDART_HOURLY_LIMIT} pictures an hour; try again later` };
  return { ok: true, job: toJob(row) };
}

/**
 * An org's finished picture joins its media library once. The claim on
 * registered_at makes parallel status reads register it only once; a failed
 * registration releases the claim for the next read. A "Just me" picture gets
 * no library row: the table is per org, and a row under 'oad' would list a
 * private file to that org's members.
 */
async function registerFinished(row: JobRow): Promise<void> {
  if (row.status !== 'done' || row.registered_at || !row.output_path || row.org_id === PERSONAL_ORG_ID) return;
  const claimed = await db`
    UPDATE wordart_jobs SET registered_at = now()
     WHERE id = ${row.id} AND org_id = ${row.org_id} AND status = 'done' AND registered_at IS NULL
    RETURNING id
  `;
  if (!claimed.length) return;
  const name = row.output_path.slice(row.output_path.lastIndexOf('/') + 1);
  const mediaId = await registerLibraryItem({
    orgId: row.org_id,
    uploadedBy: row.requested_by,
    path: row.output_path,
    url: getProxyFileUrl(row.output_path),
    storedName: name,
    originalName: name,
    mime: 'image/png',
    size: row.output_bytes ?? 0,
    mediaType: 'image',
    width: row.input.width,
    height: row.input.height,
  });
  await db`
    UPDATE wordart_jobs SET media_id = ${mediaId}, registered_at = ${mediaId ? db`now()` : null}
     WHERE id = ${row.id} AND org_id = ${row.org_id}
  `;
}

export async function getWordArtJob(userId: string, id: string): Promise<WordArtJob | null> {
  const [row] = await db<JobRow[]>`
    SELECT * FROM wordart_jobs WHERE id = ${id} AND requested_by = ${userId}
  `;
  if (!row) return null;
  await registerFinished(row);
  return toJob(row);
}

export async function listWordArtJobs(userId: string, limit = 12): Promise<WordArtJob[]> {
  const rows = await db<JobRow[]>`
    SELECT * FROM wordart_jobs WHERE requested_by = ${userId}
     ORDER BY created_at DESC LIMIT ${Math.min(Math.max(1, limit), 50)}
  `;
  for (const row of rows) await registerFinished(row);
  return rows.map(toJob);
}
