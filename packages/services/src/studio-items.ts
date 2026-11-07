/**
 * Studio lineage (migration 248): what a person's Studio material was made
 * from and what it became. Phase 1 of docs/open/STUDIO_PIPELINE_DESIGN_2026-11-06.md.
 *
 *   recording / file   (In)       a Nextcloud path
 *   reel               (Make)     a reel_projects row
 *   piece              (Channel)  a threads row in the person's channel
 *
 * Links run source → target with the slot as `role` (clip, clip2, extra,
 * artwork) or 'published' for reel → piece. Renders are not items: they hang
 * off reel_projects already.
 *
 * Every write here is best-effort and never throws: lineage must not stop a
 * save, an upload or a publish. Until migration 248 is applied the table is
 * absent and every function is a no-op (`ready` remembers that per process).
 * Callers pass the acting user; nothing here checks membership, so call it
 * only after the owning service has authorised the action.
 */

import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

const PERSONAL_ORG_ID = 'oad';

export type StudioItemKind = 'recording' | 'file' | 'reel' | 'piece';
export type StudioStage = 'in' | 'make' | 'channel';

export const STAGE_OF: Record<StudioItemKind, StudioStage> = {
  recording: 'in',
  file: 'in',
  reel: 'make',
  piece: 'channel',
};

/** Reel slots that are sources of the reel (logo, music and sounds are assets, not sources). */
export const REEL_SOURCE_SLOTS = ['clip', 'clip2', 'extra', 'artwork'] as const;

const RECORDING_PATH = /\/Private\/Video\/(Recordings|Camera|Broadcasts)\//;

export interface StudioItem {
  id: string;
  kind: StudioItemKind;
  stage: StudioStage;
  orgId: string;
  title: string;
  path: string | null;
  reelId: string | null;
  threadId: string | null;
  updatedAt: string;
}

export interface StudioTrail {
  item: StudioItem;
  /** What this was made from, with the slot it fills. */
  sources: Array<{ role: string; item: StudioItem }>;
  /** What was made from this. */
  outputs: Array<{ role: string; item: StudioItem }>;
}

interface ItemRow {
  id: string;
  kind: StudioItemKind;
  org_id: string;
  title: string;
  path: string | null;
  reel_id: string | null;
  thread_id: string | null;
  updated_at: Date;
}

const toItem = (r: ItemRow): StudioItem => ({
  id: r.id,
  kind: r.kind,
  stage: STAGE_OF[r.kind],
  orgId: r.org_id,
  title: r.title,
  path: r.path,
  reelId: r.reel_id,
  threadId: r.thread_id,
  updatedAt: r.updated_at.toISOString(),
});

// null = not known yet; false = table absent (42P01) in this process.
let ready: boolean | null = null;

async function guard<T>(what: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (ready === false) return fallback;
  try {
    const out = await fn();
    ready = true;
    return out;
  } catch (e) {
    if ((e as { code?: string }).code === '42P01') {
      ready = false;
      return fallback;
    }
    console.warn(`[studio-items] ${what}:`, (e as Error).message);
    return fallback;
  }
}

const fileName = (path: string) => path.replace(/^.*\//, '');

/** The item for a Nextcloud path (a recording or another source file), created on first use. */
export function ensureFileItem(ownerId: string, path: string, title?: string): Promise<string | null> {
  return guard('ensureFileItem', null, async () => {
    const kind: StudioItemKind = RECORDING_PATH.test(path) ? 'recording' : 'file';
    const rows = await db<{ id: string }[]>`
      INSERT INTO studio_items (id, owner_id, org_id, kind, path, title)
      VALUES (${nanoid()}, ${ownerId}, ${PERSONAL_ORG_ID}, ${kind}, ${path}, ${title ?? fileName(path)})
      ON CONFLICT (owner_id, path) WHERE path IS NOT NULL AND archived_at IS NULL
      DO UPDATE SET updated_at = now()
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  });
}

/** The item for a reel project, created on first use; keeps its title current. */
export function ensureReelItem(project: { id: string; ownerId: string; orgId: string; title: string }): Promise<string | null> {
  return guard('ensureReelItem', null, async () => {
    const rows = await db<{ id: string }[]>`
      INSERT INTO studio_items (id, owner_id, org_id, kind, reel_id, title)
      VALUES (${nanoid()}, ${project.ownerId}, ${project.orgId}, 'reel', ${project.id}, ${project.title})
      ON CONFLICT (reel_id) WHERE kind = 'reel'
      DO UPDATE SET title = EXCLUDED.title, updated_at = now(), archived_at = NULL
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  });
}

/** The item for a piece (thread) in the person's channel. */
export function ensurePieceItem(piece: { threadId: string; ownerId: string; orgId: string; title: string }): Promise<string | null> {
  return guard('ensurePieceItem', null, async () => {
    const rows = await db<{ id: string }[]>`
      INSERT INTO studio_items (id, owner_id, org_id, kind, thread_id, title)
      VALUES (${nanoid()}, ${piece.ownerId}, ${piece.orgId}, 'piece', ${piece.threadId}, ${piece.title})
      ON CONFLICT (thread_id) WHERE kind = 'piece'
      DO UPDATE SET title = EXCLUDED.title, updated_at = now(), archived_at = NULL
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  });
}

/**
 * After a reel's edit is saved: its source slots become links from file
 * items to the reel. A slot emptied or changed drops its old link.
 */
export async function syncReelSources(
  project: { id: string; ownerId: string; orgId: string; title: string },
  edit: Record<string, unknown>
): Promise<void> {
  const reelItem = await ensureReelItem(project);
  if (!reelItem) return;
  const wanted: Array<{ role: string; sourceId: string }> = [];
  for (const role of REEL_SOURCE_SLOTS) {
    const path = (edit[role] as { path?: unknown } | undefined)?.path;
    if (typeof path !== 'string' || !path) continue;
    const sourceId = await ensureFileItem(project.ownerId, path, (edit[role] as { name?: string }).name);
    if (sourceId) wanted.push({ role, sourceId });
  }
  await guard('syncReelSources', undefined, async () => {
    const roles = [...REEL_SOURCE_SLOTS] as string[];
    const keep = wanted.map((w) => `${w.sourceId}:${w.role}`);
    await db`
      DELETE FROM studio_item_links
      WHERE target_id = ${reelItem} AND role = ANY(${roles})
        AND NOT ((source_id || ':' || role) = ANY(${keep}))
    `;
    for (const w of wanted) {
      await db`
        INSERT INTO studio_item_links (source_id, target_id, role)
        VALUES (${w.sourceId}, ${reelItem}, ${w.role})
        ON CONFLICT DO NOTHING
      `;
    }
  });
}

/** A reel was published as a piece. */
export async function linkReelPublished(
  project: { id: string; ownerId: string; orgId: string; title: string },
  threadId: string
): Promise<void> {
  const [reelItem, pieceItem] = await Promise.all([
    ensureReelItem(project),
    ensurePieceItem({ threadId, ownerId: project.ownerId, orgId: project.orgId, title: project.title }),
  ]);
  if (!reelItem || !pieceItem) return;
  await guard('linkReelPublished', undefined, async () => {
    await db`
      INSERT INTO studio_item_links (source_id, target_id, role)
      VALUES (${reelItem}, ${pieceItem}, 'published')
      ON CONFLICT DO NOTHING
    `;
  });
}

export function archiveReelItem(ownerId: string, reelId: string): Promise<void> {
  return guard('archiveReelItem', undefined, async () => {
    await db`
      UPDATE studio_items SET archived_at = now()
      WHERE owner_id = ${ownerId} AND kind = 'reel' AND reel_id = ${reelId}
    `;
  });
}

/** A file was renamed: its item follows, links stay. */
export function moveFileItem(ownerId: string, from: string, to: string): Promise<void> {
  return guard('moveFileItem', undefined, async () => {
    await db`
      UPDATE studio_items SET path = ${to}, title = ${fileName(to)}, updated_at = now()
      WHERE owner_id = ${ownerId} AND path = ${from} AND archived_at IS NULL
    `;
  });
}

/** A file was deleted: the item is archived so what was made from it still shows where it came from. */
export function archiveFileItem(ownerId: string, path: string): Promise<void> {
  return guard('archiveFileItem', undefined, async () => {
    await db`
      UPDATE studio_items SET archived_at = now()
      WHERE owner_id = ${ownerId} AND path = ${path} AND archived_at IS NULL
    `;
  });
}

/** The person's items, newest first, optionally one stage. */
export function listStudioItems(ownerId: string, opts: { stage?: StudioStage; limit?: number } = {}): Promise<StudioItem[]> {
  const kinds = opts.stage
    ? (Object.keys(STAGE_OF) as StudioItemKind[]).filter((k) => STAGE_OF[k] === opts.stage)
    : (Object.keys(STAGE_OF) as StudioItemKind[]);
  return guard('listStudioItems', [] as StudioItem[], async () => {
    const rows = await db<ItemRow[]>`
      SELECT id, kind, org_id, title, path, reel_id, thread_id, updated_at
      FROM studio_items
      WHERE owner_id = ${ownerId} AND archived_at IS NULL AND kind = ANY(${kinds})
      ORDER BY updated_at DESC
      LIMIT ${Math.min(opts.limit ?? 200, 500)}
    `;
    return rows.map(toItem);
  });
}

/** One item with what it came from and what it became, looked up by the thing it points at. */
export function getStudioTrail(
  ownerId: string,
  ref: { path: string } | { reelId: string } | { threadId: string }
): Promise<StudioTrail | null> {
  return guard('getStudioTrail', null, async () => {
    const [row] =
      'path' in ref
        ? await db<ItemRow[]>`SELECT id, kind, org_id, title, path, reel_id, thread_id, updated_at FROM studio_items
            WHERE owner_id = ${ownerId} AND path = ${ref.path} AND archived_at IS NULL`
        : 'reelId' in ref
          ? await db<ItemRow[]>`SELECT id, kind, org_id, title, path, reel_id, thread_id, updated_at FROM studio_items
              WHERE owner_id = ${ownerId} AND kind = 'reel' AND reel_id = ${ref.reelId}`
          : await db<ItemRow[]>`SELECT id, kind, org_id, title, path, reel_id, thread_id, updated_at FROM studio_items
              WHERE owner_id = ${ownerId} AND kind = 'piece' AND thread_id = ${ref.threadId}`;
    if (!row) return null;
    const linked = await db<Array<ItemRow & { role: string; dir: 'source' | 'output' }>>`
      SELECT i.id, i.kind, i.org_id, i.title, i.path, i.reel_id, i.thread_id, i.updated_at, l.role, 'source' AS dir
      FROM studio_item_links l JOIN studio_items i ON i.id = l.source_id
      WHERE l.target_id = ${row.id} AND i.owner_id = ${ownerId}
      UNION ALL
      SELECT i.id, i.kind, i.org_id, i.title, i.path, i.reel_id, i.thread_id, i.updated_at, l.role, 'output' AS dir
      FROM studio_item_links l JOIN studio_items i ON i.id = l.target_id
      WHERE l.source_id = ${row.id} AND i.owner_id = ${ownerId} AND i.archived_at IS NULL
    `;
    return {
      item: toItem(row),
      sources: linked.filter((r) => r.dir === 'source').map((r) => ({ role: r.role, item: toItem(r) })),
      outputs: linked.filter((r) => r.dir === 'output').map((r) => ({ role: r.role, item: toItem(r) })),
    };
  });
}
