/**
 * Create a card.
 *
 * Everything a card is made of lands in ONE transaction: the `threads` row,
 * the `pigeon_cards` sidecar, the photo roles, the rubric claims, and any
 * proposed species. A card with a thread but no photos, or photos attached to
 * a card that failed to insert, would both be junk that someone has to clean
 * up by hand — so it is all-or-nothing.
 *
 * Cards publish immediately. There is no approval queue by design; moderation
 * is a takedown lever, not a gate (see migration 077's header).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { slugify } from "@elkdonis/utils";
import { nanoid } from "nanoid";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getClientIp, getGuest, requireWritableGuest } from "@/lib/guest";
import { checkRate, recordRate } from "@/lib/rate-limit";
import { isPlausibleCoordinate, resolveArea } from "@/lib/geo";
import { listCriteria } from "@/lib/data";
import { acceptSubmitterClaims, evaluateAuto } from "@/lib/rubric";

export const runtime = "nodejs";

const ImageSchema = z.object({
  mediaId: z.string().min(1).max(21),
  role: z.enum(["front", "side", "detail", "context"]),
  cardUrl: z.string().max(500).optional().nullable(),
  cardWidth: z.number().int().positive().optional().nullable(),
  cardHeight: z.number().int().positive().optional().nullable(),
});

const BodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  story: z.string().trim().max(2000).optional().nullable(),
  // At least one photo, and no more than four — a trading card with a dozen
  // images isn't a trading card.
  images: z.array(ImageSchema).min(1).max(4),
  speciesId: z.string().max(21).optional().nullable(),
  proposedSpeciesName: z.string().trim().max(80).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  geoSource: z.enum(["pin", "exif", "area", "none"]).default("pin"),
  geoPrecision: z.enum(["exact", "block"]).default("exact"),
  placeNote: z.string().trim().max(200).optional().nullable(),
  spottedAt: z.string().datetime().optional().nullable(),
  /** Keys of `submitter` rubric criteria the contributor ticked. */
  claimedCriteria: z.array(z.string().max(40)).max(40).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const viewer = await getViewer().catch(() => null);
    const ip = await getClientIp();
    const existingGuest = viewer ? null : await getGuest();

    if (existingGuest?.isBlocked) {
      return NextResponse.json(
        { error: "This browser has been blocked from contributing." },
        { status: 403 }
      );
    }

    if (!viewer?.canEdit) {
      const rate = await checkRate("card", {
        guestId: existingGuest?.id,
        userId: viewer?.userId,
        ip,
      });
      if (!rate.ok) {
        return NextResponse.json(
          { error: rate.reason },
          { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
        );
      }
    }

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "That submission didn't look right.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Only one photo may hold each of the two primary roles — the database has
    // a partial unique index saying so, but a clear message beats a 500.
    for (const role of ["front", "side"] as const) {
      if (body.images.filter((i) => i.role === role).length > 1) {
        return NextResponse.json(
          { error: `Only one ${role} shot per card.` },
          { status: 400 }
        );
      }
    }

    // The uploads must be this org's, and must not already belong to a card.
    // Without this check, a caller could attach someone else's photo — or the
    // same photo to a hundred cards — by guessing media ids.
    const mediaIds = body.images.map((i) => i.mediaId);
    const owned = await db<{ id: string; width: number | null; height: number | null }[]>`
      SELECT m.id, m.width, m.height
      FROM media m
      LEFT JOIN pigeon_card_images pci ON pci.media_id = m.id
      WHERE m.id = ANY(${mediaIds})
        AND m.org_id = ${siteConfig.orgId}
        AND m.type = 'image'
        AND pci.media_id IS NULL
    `;
    if (owned.length !== mediaIds.length) {
      return NextResponse.json(
        { error: "Those photos aren't available. Try uploading again." },
        { status: 400 }
      );
    }
    const dims = new Map(owned.map((m) => [m.id, m]));

    // Geography. A pin outside every known polygon is a legitimate card, just
    // an unplaced one, so a failed resolve is never an error.
    let lat: number | null = null;
    let lng: number | null = null;
    let citySlug: string | null = null;
    let areaSlug: string | null = null;

    if (body.lat != null && body.lng != null) {
      if (!isPlausibleCoordinate(body.lat, body.lng)) {
        return NextResponse.json({ error: "That location doesn't look real." }, { status: 400 });
      }
      lat = body.lat;
      lng = body.lng;
      const area = await resolveArea(lat, lng);
      if (area) {
        citySlug = area.citySlug;
        areaSlug = area.areaSlug;
      }
    }

    // Score what the machine can actually check.
    const criteria = await listCriteria();
    const auto = evaluateAuto(criteria, {
      images: body.images.map((i) => ({
        role: i.role,
        width: dims.get(i.mediaId)?.width ?? null,
        height: dims.get(i.mediaId)?.height ?? null,
      })),
    });
    const claims = acceptSubmitterClaims(criteria, body.claimedCriteria);

    // Mint the guest only now, for the same reason /api/upload does: a
    // rejected submission should leave nothing behind.
    let guestId: string | null = existingGuest?.id ?? null;
    if (!viewer && !guestId) {
      const guest = await requireWritableGuest();
      if (!guest.ok) return NextResponse.json({ error: guest.reason }, { status: 403 });
      guestId = guest.guest.id;
    }

    const threadId = nanoid(21);
    const slug = await uniqueSlug(body.title);

    await db.begin(async (tx) => {
      await tx`
        INSERT INTO threads (
          id, org_id, author_id, kind, title, slug, body,
          section, status, visibility, published_at
        ) VALUES (
          ${threadId}, ${siteConfig.orgId},
          ${viewer?.userId ?? siteConfig.sentinelUserId},
          'pigeon', ${body.title}, ${slug}, ${body.story ?? null},
          'cards', 'published', 'PUBLIC', NOW()
        )
      `;

      await tx`
        INSERT INTO pigeon_cards (
          thread_id, species_id, proposed_species_name,
          city_slug, area_slug, lat, lng, geo_source, geo_precision,
          place_note, spotted_at, auto_score, auto_max,
          guest_id, submitter_user_id
        ) VALUES (
          ${threadId}, ${body.speciesId || null}, ${body.proposedSpeciesName || null},
          ${citySlug}, ${areaSlug}, ${lat}, ${lng},
          ${lat == null ? "none" : body.geoSource}, ${body.geoPrecision},
          ${body.placeNote || null}, ${body.spottedAt ?? null},
          ${auto.score}, ${auto.max},
          ${guestId}, ${viewer?.userId ?? null}
        )
      `;

      for (const [i, image] of body.images.entries()) {
        await tx`
          INSERT INTO pigeon_card_images (
            thread_id, media_id, role, card_url, card_width, card_height, sort_order
          ) VALUES (
            ${threadId}, ${image.mediaId}, ${image.role},
            ${image.cardUrl ?? null}, ${image.cardWidth ?? null}, ${image.cardHeight ?? null},
            ${i}
          )
        `;
        // Point the shared media row at its card, now that one exists.
        await tx`
          UPDATE media SET attached_to_type = 'thread', attached_to_id = ${threadId}
          WHERE id = ${image.mediaId}
        `;
      }

      // Auto criteria are recorded as already-confirmed: the machine measured
      // them, so there is nothing for the owner to second-guess. Submitter
      // claims land unconfirmed — anyone can tick "the eye is sharp".
      for (const key of auto.passed) {
        await tx`
          INSERT INTO pigeon_card_criteria (thread_id, criterion_key, claimed, confirmed)
          VALUES (${threadId}, ${key}, TRUE, TRUE)
          ON CONFLICT (thread_id, criterion_key) DO NOTHING
        `;
      }
      for (const key of claims) {
        await tx`
          INSERT INTO pigeon_card_criteria (thread_id, criterion_key, claimed, confirmed)
          VALUES (${threadId}, ${key}, TRUE, NULL)
          ON CONFLICT (thread_id, criterion_key) DO NOTHING
        `;
      }

      if (guestId) {
        await tx`
          UPDATE pigeon_guests
          SET submission_count = submission_count + 1, last_seen_at = NOW()
          WHERE id = ${guestId}
        `;
      }
    });

    if (!viewer?.canEdit) {
      await recordRate("card", { guestId, userId: viewer?.userId, ip });
    }

    return NextResponse.json({ id: threadId, slug, autoScore: auto.score, autoMax: auto.max });
  } catch (err) {
    console.error("[pigeonshoot] createCard:", err);
    return NextResponse.json({ error: "Couldn't save that card." }, { status: 500 });
  }
}

/**
 * A slug that doesn't collide, given threads has UNIQUE(org_id, slug).
 *
 * Two people naming their bird "Steve" is not an error worth showing anyone,
 * so the second one becomes steve-2. The final fallback appends a nanoid,
 * which cannot collide in practice — a bare loop could otherwise spin forever
 * against a concurrent writer.
 */
async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 60) || "pigeon";
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const rows = await db<{ slug: string }[]>`
      SELECT slug FROM threads
      WHERE org_id = ${siteConfig.orgId} AND slug = ${candidate} LIMIT 1
    `;
    if (rows.length === 0) return candidate;
  }
  return `${base}-${nanoid(6).toLowerCase()}`;
}
