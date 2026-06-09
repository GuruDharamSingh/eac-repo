"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import { getCurrentUser } from "@/lib/session";
import { OAD_ORG_ID, getDossierMeta, isOadSteward } from "@/lib/oad";

export type ActionState = { error?: string; ok?: boolean };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function parseLinks(text: string): { label: string; href: string }[] {
  return lines(text)
    .map((line) => {
      const i = line.indexOf("|");
      if (i === -1) return { label: line, href: line };
      return { label: line.slice(0, i).trim(), href: line.slice(i + 1).trim() };
    })
    .filter((l) => l.href);
}

type DossierFields = {
  name: string;
  occupation: string;
  city: string;
  region: string;
  country: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  location: string;
  bio: string[];
  portrait_url: string;
  website: string;
  email: string;
  links: { label: string; href: string }[];
  source_note: string;
};

function num(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && String(value ?? "").trim() !== "" ? n : null;
}

function readFields(form: FormData): DossierFields | { error: string } {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "An artist name is required." };
  const city = String(form.get("city") ?? "").trim();
  const region = String(form.get("region") ?? "").trim();
  const location = String(form.get("location") ?? "").trim() || [city, region].filter(Boolean).join(", ");
  return {
    name,
    occupation: String(form.get("occupation") ?? "").trim(),
    city,
    region,
    country: String(form.get("country") ?? "").trim(),
    postal_code: String(form.get("postal_code") ?? "").trim(),
    lat: num(form.get("lat")),
    lng: num(form.get("lng")),
    location,
    bio: paragraphs(String(form.get("bio") ?? "")),
    portrait_url: String(form.get("portrait_url") ?? "").trim(),
    website: String(form.get("website") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    links: parseLinks(String(form.get("links") ?? "")),
    source_note: String(form.get("source_note") ?? "").trim(),
  };
}

// ─── create ──────────────────────────────────────────────────────────────────

export async function createDossier(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to open a file on an artist." };

  const fields = readFields(form);
  if ("error" in fields) return fields;

  const base = slugify(fields.name);
  if (!base) return { error: "Could not derive a URL from that name." };

  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db`
        INSERT INTO directory_profiles
          (org_id, slug, kind, name, role, location, city, region, country, postal_code, lat, lng,
           bio, portrait_url, website, email, links,
           status, claim_status, verified, created_by, source_note)
        VALUES (
          ${OAD_ORG_ID}, ${slug}, 'artist', ${fields.name}, ${fields.occupation || null},
          ${fields.location || null}, ${fields.city || null}, ${fields.region || null}, ${fields.country || null},
          ${fields.postal_code || null}, ${fields.lat}, ${fields.lng},
          ${db.json(fields.bio)}, ${fields.portrait_url || null}, ${fields.website || null},
          ${fields.email || null}, ${db.json(fields.links)},
          'published', 'unclaimed', false, ${user.id}, ${fields.source_note || null}
        )
      `;
      break;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/unique|duplicate/i.test(msg)) {
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        if (attempt === 4) return { error: "Could not generate a unique URL — try a more specific name." };
        continue;
      }
      console.error("[oad] createDossier error:", error);
      return { error: "Could not save the dossier." };
    }
  }

  revalidatePath("/");
  redirect(`/${slug}`);
}

// ─── edit (wiki-open: any signed-in member) ──────────────────────────────────

export async function updateDossier(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to edit this dossier." };

  const slug = String(form.get("slug") ?? "");
  if (!slug) return { error: "Missing dossier reference." };

  const fields = readFields(form);
  if ("error" in fields) return fields;

  try {
    const rows = await db`
      UPDATE directory_profiles SET
        name = ${fields.name},
        role = ${fields.occupation || null},
        location = ${fields.location || null},
        city = ${fields.city || null},
        region = ${fields.region || null},
        country = ${fields.country || null},
        postal_code = ${fields.postal_code || null},
        lat = ${fields.lat},
        lng = ${fields.lng},
        bio = ${db.json(fields.bio)},
        portrait_url = ${fields.portrait_url || null},
        website = ${fields.website || null},
        email = ${fields.email || null},
        links = ${db.json(fields.links)},
        source_note = ${fields.source_note || null},
        updated_at = NOW()
      WHERE org_id = ${OAD_ORG_ID} AND slug = ${slug}
      RETURNING id
    `;
    if (rows.length === 0) return { error: "Dossier not found." };
  } catch (error) {
    console.error("[oad] updateDossier error:", error);
    return { error: "Could not save changes." };
  }

  revalidatePath(`/${slug}`);
  revalidatePath("/");
  redirect(`/${slug}`);
}

// ─── claim ────────────────────────────────────────────────────────────────────

export async function claimDossier(slug: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to claim this dossier." };

  const meta = await getDossierMeta(slug);
  if (!meta) return { error: "Dossier not found." };
  if (meta.claim_status === "claimed") return { error: "This dossier is already claimed." };

  try {
    await db`
      UPDATE directory_profiles
      SET claim_status = 'pending', claimed_by = ${user.id}, updated_at = NOW()
      WHERE org_id = ${OAD_ORG_ID} AND slug = ${slug}
    `;
  } catch (error) {
    console.error("[oad] claimDossier error:", error);
    return { error: "Could not submit claim." };
  }
  revalidatePath(`/${slug}`);
  return { ok: true };
}

// ─── community vouch ──────────────────────────────────────────────────────────

export async function vouchForDossier(slug: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to vouch for this artist." };

  const meta = await getDossierMeta(slug);
  if (!meta) return { error: "Dossier not found." };

  try {
    await db`
      INSERT INTO directory_vouches (profile_id, user_id)
      VALUES (${meta.id}, ${user.id})
      ON CONFLICT (profile_id, user_id) DO NOTHING
    `;
  } catch (error) {
    console.error("[oad] vouchForDossier error:", error);
    return { error: "Could not record your vouch." };
  }
  revalidatePath(`/${slug}`);
  return { ok: true };
}

// ─── steward review (verify badge + approve claim) ───────────────────────────

export async function reviewDossier(
  slug: string,
  action: "verify" | "unverify" | "approve_claim"
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in required." };
  if (!(await isOadSteward(user.id))) return { error: "Only collective stewards can review dossiers." };

  try {
    if (action === "verify") {
      await db`UPDATE directory_profiles SET verified = true, verified_at = NOW(), updated_at = NOW()
               WHERE org_id = ${OAD_ORG_ID} AND slug = ${slug}`;
    } else if (action === "unverify") {
      await db`UPDATE directory_profiles SET verified = false, verified_at = NULL, updated_at = NOW()
               WHERE org_id = ${OAD_ORG_ID} AND slug = ${slug}`;
    } else if (action === "approve_claim") {
      await db`UPDATE directory_profiles SET claim_status = 'claimed', updated_at = NOW()
               WHERE org_id = ${OAD_ORG_ID} AND slug = ${slug} AND claim_status = 'pending'`;
    }
  } catch (error) {
    console.error("[oad] reviewDossier error:", error);
    return { error: "Could not apply review." };
  }
  revalidatePath(`/${slug}`);
  return { ok: true };
}
