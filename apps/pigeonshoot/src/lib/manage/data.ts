/**
 * Owner-side reads.
 *
 * Separate from src/lib/data.ts because these deliberately ignore the public
 * filters — the queue needs unrated cards, the reports screen needs hidden
 * ones. Every caller is behind requireOrgEditor(); nothing here authorises
 * anything by itself.
 *
 * Same fail-soft convention as the public layer: a broken query renders an
 * empty screen rather than a 500.
 */

import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import type { Species } from "@/lib/types";

const ORG = siteConfig.orgId;

export interface QueueCard {
  threadId: string;
  slug: string;
  title: string;
  story: string | null;
  createdAt: Date;
  autoScore: number;
  autoMax: number;
  areaName: string | null;
  speciesName: string | null;
  proposedSpeciesName: string | null;
  submitterName: string | null;
  images: Array<{ role: string; url: string; cardUrl: string | null }>;
  claims: Array<{ key: string; confirmed: boolean | null }>;
}

/** Live cards the owner hasn't rated yet, oldest first — a queue, not a feed. */
export async function listRatingQueue(limit = 30): Promise<QueueCard[]> {
  try {
    const rows = await db<
      {
        thread_id: string;
        slug: string;
        title: string;
        story: string | null;
        created_at: Date;
        auto_score: number;
        auto_max: number;
        area_name: string | null;
        species_name: string | null;
        proposed_species_name: string | null;
        submitter_name: string | null;
      }[]
    >`
      SELECT pc.thread_id, t.slug, t.title, t.body AS story, t.created_at,
             pc.auto_score, pc.auto_max, pc.proposed_species_name,
             ar.name AS area_name, sp.name AS species_name,
             COALESCE(g.handle, g.display_name, u.display_name) AS submitter_name
      FROM pigeon_cards pc
      JOIN threads t              ON t.id = pc.thread_id
      LEFT JOIN pigeon_areas ar   ON ar.city_slug = pc.city_slug AND ar.slug = pc.area_slug
      LEFT JOIN pigeon_species sp ON sp.id = pc.species_id
      LEFT JOIN pigeon_guests g   ON g.id = pc.guest_id
      LEFT JOIN users u           ON u.id = pc.submitter_user_id
      WHERE t.org_id = ${ORG}
        AND pc.tier_slug IS NULL
        AND pc.moderation_state = 'live'
      ORDER BY t.created_at ASC
      LIMIT ${limit}
    `;
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.thread_id);
    const [images, claims] = await Promise.all([
      db<{ thread_id: string; role: string; url: string; card_url: string | null }[]>`
        SELECT pci.thread_id, pci.role, m.url, pci.card_url
        FROM pigeon_card_images pci
        JOIN media m ON m.id = pci.media_id
        WHERE pci.thread_id = ANY(${ids})
        ORDER BY CASE pci.role WHEN 'front' THEN 0 WHEN 'side' THEN 1 ELSE 2 END,
                 pci.sort_order
      `,
      db<{ thread_id: string; criterion_key: string; confirmed: boolean | null }[]>`
        SELECT thread_id, criterion_key, confirmed
        FROM pigeon_card_criteria WHERE thread_id = ANY(${ids})
      `,
    ]);

    return rows.map((r) => ({
      threadId: r.thread_id,
      slug: r.slug,
      title: r.title,
      story: r.story,
      createdAt: r.created_at,
      autoScore: r.auto_score,
      autoMax: r.auto_max,
      areaName: r.area_name,
      speciesName: r.species_name,
      proposedSpeciesName: r.proposed_species_name,
      submitterName: r.submitter_name,
      images: images
        .filter((i) => i.thread_id === r.thread_id)
        .map((i) => ({ role: i.role, url: i.url, cardUrl: i.card_url })),
      claims: claims
        .filter((c) => c.thread_id === r.thread_id)
        .map((c) => ({ key: c.criterion_key, confirmed: c.confirmed })),
    }));
  } catch (err) {
    console.error("[pigeonshoot] listRatingQueue:", err);
    return [];
  }
}

export interface OpenReport {
  id: string;
  threadId: string;
  slug: string;
  cardTitle: string;
  reason: string;
  detail: string | null;
  createdAt: Date;
  moderationState: string;
  thumbUrl: string | null;
}

export async function listOpenReports(limit = 60): Promise<OpenReport[]> {
  try {
    const rows = await db<
      {
        id: string;
        thread_id: string;
        slug: string;
        card_title: string;
        reason: string;
        detail: string | null;
        created_at: Date;
        moderation_state: string;
        thumb_url: string | null;
      }[]
    >`
      SELECT r.id, r.thread_id, t.slug, t.title AS card_title, r.reason, r.detail,
             r.created_at, pc.moderation_state,
             (SELECT COALESCE(pci.card_url, m.url)
                FROM pigeon_card_images pci
                JOIN media m ON m.id = pci.media_id
               WHERE pci.thread_id = t.id
               ORDER BY CASE pci.role WHEN 'front' THEN 0 ELSE 1 END LIMIT 1) AS thumb_url
      FROM pigeon_reports r
      JOIN threads t        ON t.id = r.thread_id
      JOIN pigeon_cards pc  ON pc.thread_id = r.thread_id
      WHERE r.status = 'open' AND t.org_id = ${ORG}
      ORDER BY r.created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      threadId: r.thread_id,
      slug: r.slug,
      cardTitle: r.card_title,
      reason: r.reason,
      detail: r.detail,
      createdAt: r.created_at,
      moderationState: r.moderation_state,
      thumbUrl: r.thumb_url,
    }));
  } catch (err) {
    console.error("[pigeonshoot] listOpenReports:", err);
    return [];
  }
}

export interface GuestRow {
  id: string;
  displayName: string;
  handle: string | null;
  submissionCount: number;
  isBlocked: boolean;
  blockedReason: string | null;
  lastSeenAt: Date;
  linked: boolean;
}

export async function listGuests(limit = 100): Promise<GuestRow[]> {
  try {
    const rows = await db<
      {
        id: string;
        display_name: string;
        handle: string | null;
        submission_count: number;
        is_blocked: boolean;
        blocked_reason: string | null;
        last_seen_at: Date;
        linked_user_id: string | null;
      }[]
    >`
      SELECT id, display_name, handle, submission_count, is_blocked,
             blocked_reason, last_seen_at, linked_user_id
      FROM pigeon_guests
      ORDER BY last_seen_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      handle: r.handle,
      submissionCount: r.submission_count,
      isBlocked: r.is_blocked,
      blockedReason: r.blocked_reason,
      lastSeenAt: r.last_seen_at,
      linked: r.linked_user_id !== null,
    }));
  } catch (err) {
    console.error("[pigeonshoot] listGuests:", err);
    return [];
  }
}

/** Every species regardless of status — the review screen needs the proposals. */
export async function listAllSpecies(): Promise<Species[]> {
  try {
    const rows = await db<
      {
        id: string;
        slug: string;
        name: string;
        tagline: string | null;
        description: string | null;
        traits: unknown;
        accent_hex: string | null;
        status: Species["status"];
        merged_into: string | null;
        card_count: string;
      }[]
    >`
      SELECT sp.id, sp.slug, sp.name, sp.tagline, sp.description, sp.traits,
             sp.accent_hex, sp.status, sp.merged_into,
             COUNT(pc.thread_id) AS card_count
      FROM pigeon_species sp
      LEFT JOIN pigeon_cards pc ON pc.species_id = sp.id
      WHERE sp.org_id = ${ORG}
      GROUP BY sp.id
      ORDER BY
        CASE sp.status WHEN 'proposed' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
        sp.sort_order, sp.name
    `;
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      description: r.description,
      traits: Array.isArray(r.traits) ? (r.traits as string[]) : [],
      accentHex: r.accent_hex,
      status: r.status,
      mergedInto: r.merged_into,
      heroUrl: null,
      cardCount: Number(r.card_count),
    }));
  } catch (err) {
    console.error("[pigeonshoot] listAllSpecies:", err);
    return [];
  }
}

/**
 * Species names contributors proposed on cards that aren't in the library yet.
 * These are the real source of new species — the /manage/species screen turns
 * them into rows.
 */
export async function listProposedOnCards(): Promise<
  Array<{ threadId: string; slug: string; cardTitle: string; name: string }>
> {
  try {
    const rows = await db<
      { thread_id: string; slug: string; card_title: string; name: string }[]
    >`
      SELECT pc.thread_id, t.slug, t.title AS card_title, pc.proposed_species_name AS name
      FROM pigeon_cards pc
      JOIN threads t ON t.id = pc.thread_id
      WHERE t.org_id = ${ORG}
        AND pc.proposed_species_name IS NOT NULL
        AND pc.species_id IS NULL
        AND pc.moderation_state = 'live'
      ORDER BY t.created_at DESC
      LIMIT 100
    `;
    return rows.map((r) => ({
      threadId: r.thread_id,
      slug: r.slug,
      cardTitle: r.card_title,
      name: r.name,
    }));
  } catch (err) {
    console.error("[pigeonshoot] listProposedOnCards:", err);
    return [];
  }
}

export interface ManageStats {
  unrated: number;
  openReports: number;
  today: number;
  proposedSpecies: number;
  hidden: number;
  total: number;
}

export async function getManageStats(): Promise<ManageStats> {
  try {
    const rows = await db<Record<keyof ManageStats, string>[]>`
      SELECT
        (SELECT COUNT(*) FROM pigeon_cards pc JOIN threads t ON t.id = pc.thread_id
          WHERE t.org_id = ${ORG} AND pc.tier_slug IS NULL AND pc.moderation_state = 'live') AS unrated,
        (SELECT COUNT(*) FROM pigeon_reports r JOIN threads t ON t.id = r.thread_id
          WHERE t.org_id = ${ORG} AND r.status = 'open') AS "openReports",
        (SELECT COUNT(*) FROM threads WHERE org_id = ${ORG} AND kind = 'pigeon'
           AND created_at > NOW() - INTERVAL '24 hours') AS today,
        (SELECT COUNT(*) FROM pigeon_species WHERE org_id = ${ORG} AND status = 'proposed')
          + (SELECT COUNT(*) FROM pigeon_cards pc JOIN threads t ON t.id = pc.thread_id
              WHERE t.org_id = ${ORG} AND pc.proposed_species_name IS NOT NULL
                AND pc.species_id IS NULL) AS "proposedSpecies",
        (SELECT COUNT(*) FROM pigeon_cards pc JOIN threads t ON t.id = pc.thread_id
          WHERE t.org_id = ${ORG} AND pc.moderation_state <> 'live') AS hidden,
        (SELECT COUNT(*) FROM threads WHERE org_id = ${ORG} AND kind = 'pigeon') AS total
    `;
    const r = rows[0];
    return {
      unrated: Number(r?.unrated ?? 0),
      openReports: Number(r?.openReports ?? 0),
      today: Number(r?.today ?? 0),
      proposedSpecies: Number(r?.proposedSpecies ?? 0),
      hidden: Number(r?.hidden ?? 0),
      total: Number(r?.total ?? 0),
    };
  } catch (err) {
    console.error("[pigeonshoot] getManageStats:", err);
    return { unrated: 0, openReports: 0, today: 0, proposedSpecies: 0, hidden: 0, total: 0 };
  }
}
