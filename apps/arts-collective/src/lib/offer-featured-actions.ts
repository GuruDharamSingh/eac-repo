"use server";

import { revalidatePath } from "next/cache";
import { withOrg } from "@elkdonis/db";
import { canEditOrgIdentity } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { getOrgBySlug } from "@/lib/org";
import { FEATURED_KEY, TEMPLATE_KEY_PREFIX, cleanTemplate, isContentKey } from "@/lib/offer-load/keys";
import { kindOf, readArtworks, readFeaturedThread } from "@/lib/offer-load/read";
import type { OfferKind } from "@elkdonis/cms-ui/offer-surface";

/**
 * Which piece leads an org's single-offer page, and which template draws it. No UI yet (the hub's
 * "Current Work Page" card comes next). Same gate as offer-look-actions.ts: the session user must be an
 * owner or guide of the org in the argument (`canEditOrgIdentity` also admits global admins).
 *
 * Both actions resolve the key under the PUBLIC rule first (published, PUBLIC, no min_role, not hidden,
 * homed on or approved-listed on the org; an artwork must be in the org's own or pinned store and
 * listed), so a key that a signed-out visitor could not see is never stored.
 */

type Result = { ok: boolean; error?: string };

async function gate(orgSlug: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to save." } as const;
  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "No such organisation." } as const;
  if (!(await canEditOrgIdentity(user.id, org.id))) return { error: "Only owners and guides can change this page." } as const;
  return { org } as const;
}

/** What the key points at, if the public can see it: the kind of piece, and the thread row when it is one. */
async function resolve(orgId: string, key: string) {
  if (key.startsWith("thread:")) {
    const row = await readFeaturedThread(orgId, key.slice(7));
    return row ? { kind: kindOf(row.kind) as OfferKind, homed: row.org_id === orgId, id: row.id } : null;
  }
  const a = await readArtworks(orgId, 1, key.slice(8));
  return a.rows.length ? { kind: "artwork" as OfferKind, homed: false, id: a.rows[0]!.id } : null;
}

/** Feature one piece by content key (`thread:<id>` or `artwork:<uuid>`), or pass null to go back to the automatic pick. */
export async function setOfferFeaturedAction(orgSlug: string, key: string | null): Promise<Result> {
  const g = await gate(orgSlug);
  if ("error" in g) return { ok: false, error: g.error };
  const { org } = g;
  try {
    if (key === null) {
      await withOrg(org.id, (sql) => sql`DELETE FROM site_config WHERE org_id = ${org.id} AND key = ${FEATURED_KEY}`);
    } else {
      if (!isContentKey(key)) return { ok: false, error: "That is not a piece key." };
      if (!(await resolve(org.id, key))) return { ok: false, error: "That piece is not public on this site." };
      await withOrg(org.id, (sql) => sql`
        INSERT INTO site_config (org_id, key, value)
        VALUES (${org.id}, ${FEATURED_KEY}, ${sql.json({ key } as never)})
        ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `);
    }
  } catch (err) {
    console.error("[offer-featured] save:", err);
    return { ok: false, error: "Could not save the featured piece." };
  }
  revalidatePath(`/sites/${orgSlug}`);
  return { ok: true };
}

/**
 * Store the template for one piece. A thread homed on the org keeps it with the piece
 * (`threads.metadata.page.template`, merged so the rest of `metadata` and `page` stay); an artwork, or a
 * piece the org only lists, keeps it in site_config `offer:template:<key>`. Pass null to clear it (the
 * kind's default applies). The id must suit the piece's kind (the catalogue's `kinds`).
 */
export async function setOfferTemplateAction(orgSlug: string, key: string, template: string | null): Promise<Result> {
  const g = await gate(orgSlug);
  if ("error" in g) return { ok: false, error: g.error };
  const { org } = g;
  if (!isContentKey(key)) return { ok: false, error: "That is not a piece key." };
  const target = await resolve(org.id, key);
  if (!target) return { ok: false, error: "That piece is not public on this site." };
  const clean = template === null ? null : cleanTemplate(template, target.kind);
  if (template !== null && !clean) return { ok: false, error: "That template does not suit this piece." };
  try {
    await withOrg(org.id, async (sql) => {
      if (target.homed) {
        if (clean) {
          await sql`
            UPDATE threads SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{page}',
              COALESCE(metadata->'page', '{}'::jsonb) || jsonb_build_object('template', ${clean}::text), true)
            WHERE id = ${target.id} AND org_id = ${org.id}`;
        } else {
          await sql`UPDATE threads SET metadata = metadata #- '{page,template}' WHERE id = ${target.id} AND org_id = ${org.id}`;
        }
      } else if (clean) {
        await sql`
          INSERT INTO site_config (org_id, key, value)
          VALUES (${org.id}, ${TEMPLATE_KEY_PREFIX + key}, ${sql.json({ template: clean } as never)})
          ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
      } else {
        await sql`DELETE FROM site_config WHERE org_id = ${org.id} AND key = ${TEMPLATE_KEY_PREFIX + key}`;
      }
    });
  } catch (err) {
    console.error("[offer-featured] template:", err);
    return { ok: false, error: "Could not save the template." };
  }
  revalidatePath(`/sites/${orgSlug}`);
  return { ok: true };
}
