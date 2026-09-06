import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { isReservedSlug } from "@elkdonis/utils";
import { createUnclaimedProfile } from "@elkdonis/services";
import {
  getAdminClient,
  grantOrgAccess,
  provisionOrgOnNextcloud,
} from "@elkdonis/nextcloud";
import { requireUser } from "@/lib/session";

const TIERS = new Set(["free", "supported", "partner"]);

function normalizeSubdomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * The reserved-word check is the shared list (packages/utils reserved-slugs):
 * an org slug becomes a network subdomain, so it must not collide with
 * infrastructure hosts (`artdirect`, `www`) or app routes.
 */
function isValidSubdomain(s: string): boolean {
  if (s.length < 3 || s.length > 40) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)) return false;
  if (isReservedSlug(s)) return false;
  return true;
}

export async function POST(req: Request) {
  const user = await requireUser();

  let body: { subdomain?: string; title?: string; tier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subdomainRaw = typeof body.subdomain === "string" ? body.subdomain : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  // The tier the person is asking for. It is self-declared here and confirmed
  // by an admin from /hub/admin after the intake conversation — the row still
  // starts unconfirmed regardless of tier.
  const tier = typeof body.tier === "string" && TIERS.has(body.tier) ? body.tier : "free";

  const subdomain = normalizeSubdomain(subdomainRaw);
  if (!isValidSubdomain(subdomain)) {
    return NextResponse.json(
      {
        error:
          "Subdomain must be 3–40 lowercase letters/numbers/hyphens, not reserved.",
      },
      { status: 400 }
    );
  }
  if (title.length < 2 || title.length > 120) {
    return NextResponse.json(
      { error: "Site title must be 2–120 characters." },
      { status: 400 }
    );
  }

  // A person may own several orgs — someone already running one can start
  // something new. The only collision that matters is the slug itself.
  const collision = await db<{ slug: string }[]>`
    SELECT slug FROM organizations WHERE slug = ${subdomain} LIMIT 1
  `;
  if (collision[0]) {
    return NextResponse.json(
      { error: "That subdomain is taken. Try another.", code: "taken" },
      { status: 409 }
    );
  }

  try {
    await db.begin(async (tx) => {
      // subdomain_confirmed stays FALSE: every tier begins with an intake
      // interview, and the site serves a pending notice to the public until an
      // admin confirms it from /hub/admin. The owner sees the real site
      // throughout, so they can build while the conversation happens.
      await tx`
        INSERT INTO organizations (id, name, slug, description, subdomain_confirmed, tier)
        VALUES (${subdomain}, ${title}, ${subdomain}, ${null}, false, ${tier})
      `;
      await tx`
        INSERT INTO user_organizations (user_id, org_id, role)
        VALUES (${user.id}, ${subdomain}, 'owner')
        ON CONFLICT (user_id, org_id) DO NOTHING
      `;
      // Legacy artist_profiles is keyed on user_id alone, so a second org
      // simply keeps the person's existing row (DO NOTHING).
      await tx`
        INSERT INTO artist_profiles (user_id, org_id, display_name)
        VALUES (${user.id}, ${subdomain}, ${title})
        ON CONFLICT (user_id) DO NOTHING
      `;
    });
  } catch (err) {
    console.error("org create failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Could not create org", detail: msg },
      { status: 500 }
    );
  }

  // Every org carries its own identity row (migration 099) — its bio, portrait
  // and directory listing belong to the organisation, not to whichever member
  // happens to be first. Migration 099 backfilled the orgs that existed then;
  // without this, every org created afterwards would reach /profile with
  // nothing to show.
  try {
    const created = await createUnclaimedProfile({
      displayName: title,
      slug: subdomain,
      entityType: "organization",
      profileLayout: "standard",
      createdBy: user.id,
      sourceNote: `org:${subdomain}`,
    });
    if (created.ok) {
      await db`
        UPDATE organizations SET profile_user_id = ${created.userId} WHERE id = ${subdomain}
      `;
      // The owner created it, so it is claimed from the start — unlike an
      // associated org, which stays unclaimed and staff-edited.
      await db`
        UPDATE users SET claim_status = 'claimed', claimed_by = ${user.id}
        WHERE id = ${created.userId}
      `;
    } else {
      // `in` rather than `created.error`: CreateProfileResult is a true
      // discriminated union, which this codebase has repeatedly found does
      // not narrow on `if (x.ok)` — see profiles.ts's SaveResult note.
      console.warn(
        "org identity profile not created:",
        "error" in created ? created.error : "unknown"
      );
    }
  } catch (err) {
    // The org itself is already created and usable; a missing identity row
    // shows up as an empty /profile, not a broken one.
    console.warn("org identity profile deferred:", err);
  }

  // Best-effort Nextcloud provisioning: org folder tree under the service
  // account, shared read/write to the owner if they already have NC
  // credentials. Failures don't block org creation — the Silex token route
  // re-runs the same idempotent provisioning on first editor launch.
  try {
    const admin = getAdminClient();
    const { orgFolderPath } = await provisionOrgOnNextcloud(admin, subdomain);
    await db`
      UPDATE organizations
      SET nextcloud_folder_path = ${orgFolderPath}
      WHERE id = ${subdomain}
    `;

    const owners = await db<{ nextcloud_user_id: string | null }[]>`
      SELECT nextcloud_user_id FROM users WHERE id = ${user.id} LIMIT 1
    `;
    const ncUserId = owners[0]?.nextcloud_user_id;
    if (ncUserId) {
      await grantOrgAccess(admin, subdomain, ncUserId, "owner");
    }
  } catch (err) {
    console.warn("org nextcloud provisioning deferred:", err);
  }

  return NextResponse.json({ ok: true, slug: subdomain, tier });
}
