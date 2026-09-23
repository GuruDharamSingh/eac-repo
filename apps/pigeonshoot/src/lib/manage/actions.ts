"use server";

/**
 * Owner mutations.
 *
 * A server action is a PUBLIC ENDPOINT. Being importable only from a page
 * under /manage authorises nothing — the action is callable by anyone who can
 * construct the request. So every action here re-checks requireOrgEditor()
 * itself, independently, rather than trusting the layout gate.
 */

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import { slugify } from "@elkdonis/utils";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";
import { deleteFile } from "@/lib/nextcloud";

const ORG = siteConfig.orgId;

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ─── rating ──────────────────────────────────────────────────────────────────

/**
 * Rate a card.
 *
 * The confirmed criteria are what the score is built from, and each one's
 * points are FROZEN onto the row at this moment. Re-weighting a criterion
 * later must not silently re-score every card ever rated — old verdicts stay
 * exactly as the owner left them.
 */
export async function rateCard(input: {
  threadId: string;
  tierSlug: string;
  confirmedKeys: string[];
  note?: string | null;
}): Promise<ActionResult> {
  const viewer = await requireOrgEditor();

  try {
    const criteria = await db<{ key: string; points: number }[]>`
      SELECT key, points FROM pigeon_criteria WHERE org_id = ${ORG}
    `;
    const points = new Map(criteria.map((c) => [c.key, c.points]));
    const confirmed = new Set(input.confirmedKeys.filter((k) => points.has(k)));
    const score = [...confirmed].reduce((n, k) => n + (points.get(k) ?? 0), 0);

    await db.begin(async (tx) => {
      // Every criterion that exists gets a row, so the card page can show what
      // was rejected as well as what was awarded.
      for (const [key, pts] of points) {
        const isConfirmed = confirmed.has(key);
        await tx`
          INSERT INTO pigeon_card_criteria (thread_id, criterion_key, claimed, confirmed, points_awarded)
          VALUES (${input.threadId}, ${key}, ${isConfirmed}, ${isConfirmed}, ${isConfirmed ? pts : 0})
          ON CONFLICT (thread_id, criterion_key)
          DO UPDATE SET confirmed = ${isConfirmed}, points_awarded = ${isConfirmed ? pts : 0}
        `;
      }

      await tx`
        UPDATE pigeon_cards
        SET tier_slug = ${input.tierSlug},
            owner_score = ${score},
            rating_note = ${input.note || null},
            rated_by = ${viewer.userId},
            rated_at = NOW(),
            updated_at = NOW()
        WHERE thread_id = ${input.threadId}
      `;
    });

    revalidatePath("/manage/queue");
    revalidatePath("/cards");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] rateCard:", err);
    return { ok: false, error: "Couldn't save that rating." };
  }
}

// ─── moderation ──────────────────────────────────────────────────────────────

/**
 * Hide or remove a card.
 *
 * 'hidden' keeps the row and the files, for a card that's simply not wanted in
 * the gallery. 'removed' DESTROYS the stored photos — a copyright complaint or
 * an identifiable person needs the bytes gone, not just unlinked. That is not
 * reversible, which is why it's a separate state rather than a flag.
 */
export async function moderateCard(input: {
  threadId: string;
  state: "live" | "hidden" | "removed";
  note?: string | null;
}): Promise<ActionResult> {
  const viewer = await requireOrgEditor();

  try {
    if (input.state === "removed") {
      const paths = await db<{ nextcloud_path: string }[]>`
        SELECT m.nextcloud_path
        FROM pigeon_card_images pci
        JOIN media m ON m.id = pci.media_id
        WHERE pci.thread_id = ${input.threadId}
      `;
      for (const { nextcloud_path } of paths) {
        // Best-effort per file: one failure must not leave the card visible.
        await deleteFile(nextcloud_path).catch((err) =>
          console.error("[pigeonshoot] moderate delete full:", nextcloud_path, err)
        );
        const cardPath = nextcloud_path.replace(
          "/Media/Images/",
          "/Media/Images/card/"
        );
        await deleteFile(cardPath).catch(() => {});
      }
    }

    await db.begin(async (tx) => {
      await tx`
        UPDATE pigeon_cards
        SET moderation_state = ${input.state},
            moderation_note = ${input.note || null},
            moderated_by = ${viewer.userId},
            moderated_at = NOW(),
            updated_at = NOW()
        WHERE thread_id = ${input.threadId}
      `;
      // Keep the thread's own status in step, so any shared read path that
      // doesn't know about pigeon_cards still hides it.
      await tx`
        UPDATE threads
        SET status = ${input.state === "live" ? "published" : "archived"}, updated_at = NOW()
        WHERE id = ${input.threadId}
      `;
    });

    revalidatePath("/manage/reports");
    revalidatePath("/cards");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] moderateCard:", err);
    return { ok: false, error: "Couldn't apply that." };
  }
}

export async function resolveReport(input: {
  reportId: string;
  status: "dismissed" | "actioned";
}): Promise<ActionResult> {
  const viewer = await requireOrgEditor();
  try {
    await db.begin(async (tx) => {
      const rows = await tx<{ thread_id: string }[]>`
        UPDATE pigeon_reports
        SET status = ${input.status}, resolved_by = ${viewer.userId}, resolved_at = NOW()
        WHERE id = ${input.reportId} AND status = 'open'
        RETURNING thread_id
      `;
      if (rows.length > 0) {
        await tx`
          UPDATE pigeon_cards
          SET open_report_count = GREATEST(0, open_report_count - 1)
          WHERE thread_id = ${rows[0].thread_id}
        `;
      }
    });
    revalidatePath("/manage/reports");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] resolveReport:", err);
    return { ok: false, error: "Couldn't resolve that report." };
  }
}

export async function setGuestBlocked(input: {
  guestId: string;
  blocked: boolean;
  reason?: string | null;
}): Promise<ActionResult> {
  await requireOrgEditor();
  try {
    await db`
      UPDATE pigeon_guests
      SET is_blocked = ${input.blocked},
          blocked_reason = ${input.blocked ? input.reason || null : null},
          blocked_at = ${input.blocked ? db`NOW()` : null}
      WHERE id = ${input.guestId}
    `;
    revalidatePath("/manage/guests");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] setGuestBlocked:", err);
    return { ok: false, error: "Couldn't update that contributor." };
  }
}

// ─── species ─────────────────────────────────────────────────────────────────

export async function updateSpeciesStatus(input: {
  speciesId: string;
  status: "proposed" | "published" | "merged" | "rejected";
  mergedInto?: string | null;
}): Promise<ActionResult> {
  await requireOrgEditor();
  try {
    await db.begin(async (tx) => {
      await tx`
        UPDATE pigeon_species
        SET status = ${input.status},
            merged_into = ${input.status === "merged" ? input.mergedInto || null : null},
            updated_at = NOW()
        WHERE id = ${input.speciesId} AND org_id = ${ORG}
      `;
      // Merging must move the cards too, or they'd point at a species that no
      // longer has a page.
      if (input.status === "merged" && input.mergedInto) {
        await tx`
          UPDATE pigeon_cards SET species_id = ${input.mergedInto}, updated_at = NOW()
          WHERE species_id = ${input.speciesId}
        `;
      }
    });
    revalidatePath("/manage/species");
    revalidatePath("/species");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] updateSpeciesStatus:", err);
    return { ok: false, error: "Couldn't update that species." };
  }
}

/** Turn a contributor's proposed name on a card into a real species. */
export async function promoteProposedSpecies(input: {
  threadId: string;
  name: string;
}): Promise<ActionResult> {
  await requireOrgEditor();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Needs a name." };

  try {
    const slug = slugify(name).slice(0, 60) || `species-${nanoid(6).toLowerCase()}`;
    const id = nanoid(21);

    await db.begin(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        INSERT INTO pigeon_species (id, org_id, slug, name, status)
        VALUES (${id}, ${ORG}, ${slug}, ${name}, 'published')
        ON CONFLICT (org_id, slug) DO UPDATE SET status = 'published'
        RETURNING id
      `;
      await tx`
        UPDATE pigeon_cards
        SET species_id = ${rows[0].id}, proposed_species_name = NULL, updated_at = NOW()
        WHERE thread_id = ${input.threadId}
      `;
    });

    revalidatePath("/manage/species");
    revalidatePath("/species");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] promoteProposedSpecies:", err);
    return { ok: false, error: "Couldn't create that species." };
  }
}

// ─── rubric ──────────────────────────────────────────────────────────────────

export async function upsertCriterion(input: {
  key: string;
  label: string;
  hint?: string | null;
  category?: string;
  points: number;
  source: "submitter" | "auto" | "owner";
  autoCheck?: string | null;
  isActive: boolean;
  sortOrder: number;
}): Promise<ActionResult> {
  await requireOrgEditor();
  const key = slugify(input.key).replace(/-/g, "_").slice(0, 40);
  if (!key || !input.label.trim()) return { ok: false, error: "Needs a key and a label." };

  try {
    await db`
      INSERT INTO pigeon_criteria (
        org_id, key, label, hint, category, points, source, auto_check, is_active, sort_order
      ) VALUES (
        ${ORG}, ${key}, ${input.label.trim()}, ${input.hint || null},
        ${input.category || "craft"}, ${input.points}, ${input.source},
        ${input.source === "auto" ? input.autoCheck || null : null},
        ${input.isActive}, ${input.sortOrder}
      )
      ON CONFLICT (org_id, key) DO UPDATE SET
        label = EXCLUDED.label, hint = EXCLUDED.hint, category = EXCLUDED.category,
        points = EXCLUDED.points, source = EXCLUDED.source, auto_check = EXCLUDED.auto_check,
        is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, updated_at = NOW()
    `;
    revalidatePath("/manage/rubric");
    revalidatePath("/rubric");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] upsertCriterion:", err);
    return { ok: false, error: "Couldn't save that criterion." };
  }
}

/**
 * Retire a criterion rather than deleting it.
 *
 * Deleting would orphan every pigeon_card_criteria row referencing it and
 * erase part of the reasoning behind past ratings. Deactivating removes it
 * from the submit form and the rubric page while leaving history intact.
 */
export async function deactivateCriterion(key: string): Promise<ActionResult> {
  await requireOrgEditor();
  try {
    await db`
      UPDATE pigeon_criteria SET is_active = FALSE, updated_at = NOW()
      WHERE org_id = ${ORG} AND key = ${key}
    `;
    revalidatePath("/manage/rubric");
    revalidatePath("/rubric");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] deactivateCriterion:", err);
    return { ok: false, error: "Couldn't retire that criterion." };
  }
}

export async function upsertTier(input: {
  slug: string;
  label: string;
  blurb?: string | null;
  minScore: number;
  accentHex: string;
  frameStyle: "plain" | "metal" | "foil" | "holo";
  isActive: boolean;
  sortOrder: number;
}): Promise<ActionResult> {
  await requireOrgEditor();
  const slug = slugify(input.slug).slice(0, 30);
  if (!slug || !input.label.trim()) return { ok: false, error: "Needs a slug and a label." };
  if (!/^#[0-9a-f]{6}$/i.test(input.accentHex)) {
    return { ok: false, error: "Colour must be a hex value like #7FA88C." };
  }

  try {
    await db`
      INSERT INTO pigeon_tiers (
        org_id, slug, label, blurb, min_score, accent_hex, frame_style, is_active, sort_order
      ) VALUES (
        ${ORG}, ${slug}, ${input.label.trim()}, ${input.blurb || null},
        ${input.minScore}, ${input.accentHex}, ${input.frameStyle},
        ${input.isActive}, ${input.sortOrder}
      )
      ON CONFLICT (org_id, slug) DO UPDATE SET
        label = EXCLUDED.label, blurb = EXCLUDED.blurb, min_score = EXCLUDED.min_score,
        accent_hex = EXCLUDED.accent_hex, frame_style = EXCLUDED.frame_style,
        is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order
    `;
    revalidatePath("/manage/rubric");
    revalidatePath("/rubric");
    revalidatePath("/cards");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] upsertTier:", err);
    return { ok: false, error: "Couldn't save that tier." };
  }
}

// ─── card editing ────────────────────────────────────────────────────────────

export async function updateCard(input: {
  threadId: string;
  title: string;
  story?: string | null;
  speciesId?: string | null;
  placeNote?: string | null;
}): Promise<ActionResult> {
  await requireOrgEditor();
  if (!input.title.trim()) return { ok: false, error: "Needs a title." };

  try {
    await db.begin(async (tx) => {
      await tx`
        UPDATE threads SET title = ${input.title.trim()}, body = ${input.story || null}, updated_at = NOW()
        WHERE id = ${input.threadId} AND org_id = ${ORG}
      `;
      await tx`
        UPDATE pigeon_cards
        SET species_id = ${input.speciesId || null},
            place_note = ${input.placeNote || null},
            updated_at = NOW()
        WHERE thread_id = ${input.threadId}
      `;
    });
    revalidatePath("/cards");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] updateCard:", err);
    return { ok: false, error: "Couldn't save that card." };
  }
}

/** Site copy — org_site_sections, the same shape amrit-canada's editor uses. */
export async function saveSection(
  sectionKey: string,
  content: Record<string, string>
): Promise<ActionResult> {
  const viewer = await requireOrgEditor();
  try {
    await db`
      INSERT INTO org_site_sections (org_id, section_key, content, updated_by, updated_at)
      VALUES (${ORG}, ${sectionKey}, ${db.json(content)}, ${viewer.userId}, NOW())
      ON CONFLICT (org_id, section_key)
      DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
    revalidatePath("/");
    revalidatePath("/about");
    revalidatePath("/rubric");
    return { ok: true };
  } catch (err) {
    console.error("[pigeonshoot] saveSection:", err);
    return { ok: false, error: "Couldn't save that copy." };
  }
}
