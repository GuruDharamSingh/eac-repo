/**
 * Social posts: the Studio's Post kind (migration 219, 2026-10-31).
 *
 * A post written for Facebook, Instagram and Threads rather than for the
 * network: text, images, a link, per-platform overrides, and the record of
 * where it was posted. Owner-scoped: every function takes the acting user
 * and a post from another account is simply not found. Posting itself is
 * the host's server action (it needs the person's connections); this file
 * is the rows.
 */

import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

export type SocialPlatform = 'facebook' | 'instagram' | 'threads';

export interface SocialImage {
  /** `/api/media/...` on the network host, outside any Private/ folder. */
  url: string;
  alt?: string | null;
}

export interface SocialShare {
  targetId: string;
  kind: 'page' | 'instagram' | 'threads';
  label: string;
  url: string | null;
  at: string;
}

export interface SocialPost {
  id: string;
  orgId: string;
  ownerId: string;
  title: string;
  body: string;
  link: string | null;
  images: SocialImage[];
  /** Per-platform text that replaces `body` when set. */
  variants: Partial<Record<SocialPlatform, { text?: string | null }>>;
  shares: SocialShare[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialPostPatch {
  title?: string;
  body?: string;
  link?: string | null;
  images?: SocialImage[];
  variants?: SocialPost['variants'];
}

interface Row {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  body: string;
  link: string | null;
  images: unknown;
  variants: unknown;
  shares: unknown;
  created_at: Date;
  updated_at: Date;
}

const COLS = db`id, org_id, owner_id, title, body, link, images, variants, shares, created_at, updated_at`;
const json = (v: unknown) => db.json(v as Parameters<typeof db.json>[0]);

function toPost(r: Row): SocialPost {
  return {
    id: r.id,
    orgId: r.org_id,
    ownerId: r.owner_id,
    title: r.title,
    body: r.body,
    link: r.link,
    images: Array.isArray(r.images) ? (r.images as SocialImage[]) : [],
    variants: r.variants && typeof r.variants === 'object' ? (r.variants as SocialPost['variants']) : {},
    shares: Array.isArray(r.shares) ? (r.shares as SocialShare[]) : [],
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/** The person's posts, newest first; `orgId` narrows to one acting org. */
export async function listSocialPosts(userId: string, orgId?: string | null): Promise<SocialPost[]> {
  const rows = await db<Row[]>`
    SELECT ${COLS} FROM social_posts
    WHERE owner_id = ${userId} AND archived_at IS NULL
      AND (${orgId ?? null}::text IS NULL OR org_id = ${orgId ?? null})
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  return rows.map(toPost);
}

export async function getSocialPost(userId: string, id: string): Promise<SocialPost | null> {
  const rows = await db<Row[]>`
    SELECT ${COLS} FROM social_posts WHERE id = ${id} AND owner_id = ${userId} AND archived_at IS NULL
  `;
  return rows[0] ? toPost(rows[0]) : null;
}

export async function createSocialPost(userId: string, orgId: string): Promise<SocialPost> {
  const id = nanoid();
  const rows = await db<Row[]>`
    INSERT INTO social_posts (id, org_id, owner_id) VALUES (${id}, ${orgId}, ${userId})
    RETURNING ${COLS}
  `;
  return toPost(rows[0]!);
}

const MAX_IMAGES = 10;

function cleanImages(images: SocialImage[]): SocialImage[] {
  return images
    .filter((i) => i && typeof i.url === 'string' && /^\/api\/media\//.test(i.url) && !/\/private\//i.test(i.url))
    .slice(0, MAX_IMAGES)
    .map((i) => ({ url: i.url, alt: i.alt ? String(i.alt).slice(0, 300) : null }));
}

export async function updateSocialPost(userId: string, id: string, patch: SocialPostPatch): Promise<SocialPost | null> {
  const current = await getSocialPost(userId, id);
  if (!current) return null;
  const title = patch.title !== undefined ? patch.title.slice(0, 200) : current.title;
  const body = patch.body !== undefined ? patch.body.slice(0, 63_000) : current.body;
  const link = patch.link !== undefined ? (patch.link?.trim() || null) : current.link;
  const images = patch.images !== undefined ? cleanImages(patch.images) : current.images;
  const variants = patch.variants !== undefined ? patch.variants : current.variants;
  const rows = await db<Row[]>`
    UPDATE social_posts SET title = ${title}, body = ${body}, link = ${link},
      images = ${json(images)}, variants = ${json(variants)}, updated_at = now()
    WHERE id = ${id} AND owner_id = ${userId}
    RETURNING ${COLS}
  `;
  return rows[0] ? toPost(rows[0]) : null;
}

export async function archiveSocialPost(userId: string, id: string): Promise<boolean> {
  const r = await db`UPDATE social_posts SET archived_at = now() WHERE id = ${id} AND owner_id = ${userId} AND archived_at IS NULL`;
  return r.count > 0;
}

/** Append a share; never assigns the array, so two posts in flight both land. */
export async function recordSocialShare(userId: string, id: string, share: SocialShare): Promise<void> {
  await db`
    UPDATE social_posts SET shares = COALESCE(shares, '[]'::jsonb) || ${json([share])}, updated_at = now()
    WHERE id = ${id} AND owner_id = ${userId}
  `;
}
