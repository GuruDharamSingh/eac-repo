"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { nanoid } from "nanoid";
import {
  getOrgFeed,
  upsertServiceOffering,
  deleteServiceOffering,
} from "@elkdonis/services";
import { confirmEtransferReceived } from "@elkdonis/commerce/server";
import { getOrderLines } from "@elkdonis/commerce/queries";
import { requireOrgEditor } from "@/lib/auth";
import {
  contentFormSchema,
  slugifyTitle,
  type ContentFormValues,
} from "@/lib/cms/schema";
import { siteConfig } from "@/config/site";
import { deriveExcerpt } from "@elkdonis/utils";
import { ensureUniqueThreadSlug } from "@elkdonis/services";

/**
 * Server actions for /manage.
 *
 * Every action re-checks authorisation via requireOrgEditor() rather than
 * trusting the page that rendered the form — a server action is a public
 * endpoint, and the /manage layout gate only controls what gets rendered.
 * Same contract as amrit-canada's lib/cms/actions.ts.
 */

const ORG = siteConfig.orgId;

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
  path?: string;
}

/** Per-org unique slug, suffixing until free. Excludes the row being edited. */

/** Strip tags for the card preview when the author didn't write an excerpt. */
function revalidateFeed(feedSlug: string, slug?: string) {
  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath(`/${feedSlug}`);
  if (slug) revalidatePath(`/${feedSlug}/${slug}`);
  // Services have their own bespoke marketplace routes alongside the feed.
  if (feedSlug === "services") {
    revalidatePath("/services");
    if (slug) revalidatePath(`/services/${slug}`);
  }
}

/**
 * Create or update a piece of content.
 *
 * `threadId` present means update. A post writes `threads` directly; a
 * service delegates to upsertServiceOffering, which writes the same row plus
 * its workshop_pages sidecar in one transaction.
 */
export async function saveContentAction(
  input: ContentFormValues,
  threadId?: string
): Promise<ActionResult> {
  const editor = await requireOrgEditor();

  const parsed = contentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const data = parsed.data;

  // The feed must exist in this org — a section slug is not free text, or a
  // typo would publish content to a page that doesn't render.
  const feed = await getOrgFeed(ORG, data.feedSlug);
  if (!feed) return { ok: false, error: "That page doesn't exist" };

  try {
    if (data.kind === "service") {
      const { id, slug } = await upsertServiceOffering(
        ORG,
        editor.userId,
        {
          title: data.title,
          subtitle: data.subtitle || null,
          descriptionShort: deriveExcerpt(data.body, { explicit: data.excerpt }) ?? data.title,
          body: data.body || null,
          bookingType: data.bookingType,
          format: data.format ?? null,
          price: data.price,
          currency: data.currency,
          priceSlidingMin: data.slidingScale ? (data.priceSlidingMin ?? null) : null,
          slidingScaleNote: data.slidingScale ? data.slidingScaleNote || null : null,
          registrationStatus: data.registrationStatus,
          sessionCount: data.sessionCount ?? null,
          sessionDurationHrs: data.sessionDurationHrs ?? null,
          recurrenceLabel: data.recurrenceLabel || null,
          location: data.location || null,
          coverImageUrl: data.coverImageUrl || null,
          bannerImageUrl: data.bannerImageUrl || null,
          status: data.status,
          visibility: data.visibility,
          section: data.feedSlug,
        },
        threadId
      );

      revalidateFeed(data.feedSlug, slug);
      return { ok: true, id, path: `/services/${slug}` };
    }

    // kind === 'post'
    const slug = await ensureUniqueThreadSlug(ORG, slugifyTitle(data.title), threadId);
    const excerpt = deriveExcerpt(data.body, { explicit: data.excerpt });
    const publishedAt = data.status === "published" ? new Date() : null;
    const metadata = data.coverImageUrl ? { coverImageUrl: data.coverImageUrl } : {};

    if (threadId) {
      const [existing] = await db<{ id: string }[]>`
        SELECT id FROM threads WHERE id = ${threadId} AND org_id = ${ORG} LIMIT 1
      `;
      if (!existing) return { ok: false, error: "Not found" };

      await db`
        UPDATE threads SET
          kind         = 'post',
          section      = ${data.feedSlug},
          title        = ${data.title},
          slug         = ${slug},
          body         = ${data.body || null},
          excerpt      = ${excerpt},
          status       = ${data.status},
          visibility   = ${data.visibility},
          metadata     = ${db.json(metadata)},
          published_at = COALESCE(published_at, ${publishedAt}),
          updated_at   = NOW()
        WHERE id = ${threadId} AND org_id = ${ORG}
      `;

      revalidateFeed(data.feedSlug, slug);
      return { ok: true, id: threadId, path: `/${data.feedSlug}/${slug}` };
    }

    const id = nanoid(21);
    await db`
      INSERT INTO threads (
        id, org_id, author_id, kind, section, title, slug, body, excerpt,
        status, visibility, metadata, is_rsvp_enabled, published_at
      ) VALUES (
        ${id}, ${ORG}, ${editor.userId}, 'post', ${data.feedSlug},
        ${data.title}, ${slug}, ${data.body || null}, ${excerpt},
        ${data.status}, ${data.visibility}, ${db.json(metadata)}, FALSE, ${publishedAt}
      )
    `;

    revalidateFeed(data.feedSlug, slug);
    return { ok: true, id, path: `/${data.feedSlug}/${slug}` };
  } catch (err) {
    console.error("[hidden-enneagram] saveContentAction:", err);
    return { ok: false, error: "Could not save. Try again." };
  }
}

export async function deleteContentAction(threadId: string): Promise<ActionResult> {
  await requireOrgEditor();

  try {
    // Services cascade to workshop_pages; deleteServiceOffering is kind-scoped
    // so fall through to the generic delete for posts.
    const [row] = await db<{ section: string | null; kind: string }[]>`
      DELETE FROM threads WHERE id = ${threadId} AND org_id = ${ORG}
      RETURNING section, kind
    `;
    if (!row) return { ok: false, error: "Not found" };
    revalidateFeed(row.section ?? "");
    return { ok: true };
  } catch (err) {
    console.error("[hidden-enneagram] deleteContentAction:", err);
    return { ok: false, error: "Could not delete." };
  }
}

/** Publish or unpublish without opening the full form. */
export async function setContentStatusAction(
  threadId: string,
  status: "draft" | "published"
): Promise<ActionResult> {
  await requireOrgEditor();

  try {
    const [row] = await db<{ section: string | null; slug: string }[]>`
      UPDATE threads SET
        status = ${status},
        published_at = CASE
          WHEN ${status} = 'published' THEN COALESCE(published_at, NOW())
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = ${threadId} AND org_id = ${ORG}
      RETURNING section, slug
    `;
    if (!row) return { ok: false, error: "Not found" };
    revalidateFeed(row.section ?? "", row.slug);
    return { ok: true };
  } catch (err) {
    console.error("[hidden-enneagram] setContentStatusAction:", err);
    return { ok: false, error: "Could not update." };
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * Mark a service order's eTransfer as received. Verifies the order belongs to
 * this org before touching it — orders aren't org-scoped by a single column,
 * so we check the line rather than trusting the id alone.
 */
export async function confirmServiceOrderAction(orderId: string): Promise<ActionResult> {
  const editor = await requireOrgEditor();

  try {
    const lines = await getOrderLines(orderId);
    if (!lines.some((l) => l.orgId === ORG)) {
      return { ok: false, error: "Not found" };
    }

    await confirmEtransferReceived({ orderId, confirmedByUserId: editor.userId });
    revalidatePath("/manage/orders");
    return { ok: true };
  } catch (err) {
    console.error("[hidden-enneagram] confirmServiceOrderAction:", err);
    return { ok: false, error: "Could not confirm this order." };
  }
}

/** Kept so the services list keeps working; delegates to the generic delete. */
export async function deleteServiceAction(threadId: string): Promise<ActionResult> {
  await requireOrgEditor();
  const ok = await deleteServiceOffering(ORG, threadId);
  if (!ok) return { ok: false, error: "Not found" };
  revalidateFeed("services");
  return { ok: true };
}
