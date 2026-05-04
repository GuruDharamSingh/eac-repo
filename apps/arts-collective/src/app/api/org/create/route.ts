import { NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { requireUser } from "@/lib/session";

const RESERVED = new Set([
  "www",
  "api",
  "admin",
  "hub",
  "app",
  "account",
  "login",
  "signup",
  "artists",
  "commitments",
  "wizard",
  "complete",
  "sites",
]);

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

function isValidSubdomain(s: string): boolean {
  if (s.length < 3 || s.length > 40) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)) return false;
  if (RESERVED.has(s)) return false;
  return true;
}

export async function POST(req: Request) {
  const user = await requireUser();

  let body: { subdomain?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subdomainRaw = typeof body.subdomain === "string" ? body.subdomain : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";

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

  const existingOrgForUser = await db<{ org_id: string }[]>`
    SELECT org_id FROM user_organizations
    WHERE user_id = ${user.id} AND role = 'owner'
    LIMIT 1
  `;
  if (existingOrgForUser[0]) {
    return NextResponse.json(
      { ok: true, slug: existingOrgForUser[0].org_id, already: true }
    );
  }

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
      await tx`
        INSERT INTO organizations (id, name, slug, description, subdomain_confirmed)
        VALUES (${subdomain}, ${title}, ${subdomain}, ${null}, true)
      `;
      await tx`
        INSERT INTO user_organizations (user_id, org_id, role)
        VALUES (${user.id}, ${subdomain}, 'owner')
        ON CONFLICT (user_id, org_id) DO NOTHING
      `;
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

  return NextResponse.json({ ok: true, slug: subdomain });
}
