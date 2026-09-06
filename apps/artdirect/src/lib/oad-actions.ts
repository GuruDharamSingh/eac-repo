"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createUnclaimedProfile,
  updateProfile,
  canEditProfile,
  requestClaim,
  approveClaim,
  vouchForProfile,
  setProfileVerified,
  getProfileBySlug,
  type SocialLink,
} from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { getDossierMeta, isOadSteward } from "@/lib/oad";

export type ActionState = { error?: string; ok?: boolean };

function paragraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function parseLinks(text: string): SocialLink[] {
  return lines(text)
    .map((line) => {
      const i = line.indexOf("|");
      if (i === -1) return { label: null, url: line };
      return { label: line.slice(0, i).trim() || null, url: line.slice(i + 1).trim() };
    })
    .filter((l) => l.url);
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
  bio: string;
  portrait_url: string;
  website: string;
  email: string;
  links: SocialLink[];
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

/** links + website + email folded into one social_links list — see oad.ts's read-side split. */
function socialLinksFor(fields: DossierFields): SocialLink[] {
  const out = [...fields.links];
  if (fields.email) out.push({ label: "Email", url: `mailto:${fields.email}` });
  if (fields.website) out.push({ label: "Website", url: fields.website });
  return out;
}

// ─── create ──────────────────────────────────────────────────────────────────

export async function createDossier(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to open a file on an artist." };

  const fields = readFields(form);
  if ("error" in fields) return fields;

  const result = await createUnclaimedProfile({
    displayName: fields.name,
    headline: fields.occupation || null,
    bio: fields.bio || null,
    avatarUrl: fields.portrait_url || null,
    city: fields.city || null,
    region: fields.region || null,
    country: fields.country || null,
    postalCode: fields.postal_code || null,
    lat: fields.lat,
    lng: fields.lng,
    socialLinks: socialLinksFor(fields),
    sourceNote: fields.source_note || null,
    oadDossier: fields.location ? { location: fields.location } : {},
    createdBy: user.id,
  });
  if (!result.ok) {
    // TS fails to narrow this discriminated union across the package
    // boundary here (moduleResolution: bundler resolving @elkdonis/services'
    // types through more than one import path within this app) — confirmed
    // correct at runtime; the cast just states what's already true.
    return { error: (result as { error: string }).error };
  }

  revalidatePath("/");
  redirect(`/${result.slug}`);
}

// ─── edit (wiki-open: any signed-in member) ──────────────────────────────────

export async function updateDossier(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to edit this dossier." };

  const slug = String(form.get("slug") ?? "");
  if (!slug) return { error: "Missing dossier reference." };

  const profile = await getProfileBySlug(slug);
  if (!profile) return { error: "Dossier not found." };

  // ArtDirect is wiki-open by design (any signed-in member may improve an
  // unclaimed dossier), which is broader than canEditProfile's "self or
  // admin" rule — so a claimed profile still requires the owner or a
  // steward, but an unclaimed/pending one accepts any signed-in edit.
  if (profile.claimStatus === "claimed") {
    const allowed = (await canEditProfile(user.id, profile.userId)) || (await isOadSteward(user.id));
    if (!allowed) return { error: "This dossier has been claimed — only its owner can edit it now." };
  }

  const fields = readFields(form);
  if ("error" in fields) return fields;

  await updateProfile(profile.userId, {
    displayName: fields.name,
    headline: fields.occupation || null,
    bio: fields.bio || null,
    avatarUrl: fields.portrait_url || null,
    city: fields.city || null,
    region: fields.region || null,
    country: fields.country || null,
    postalCode: fields.postal_code || null,
    lat: fields.lat,
    lng: fields.lng,
    socialLinks: socialLinksFor(fields),
    sourceNote: fields.source_note || null,
    oadDossier: { ...profile.oadDossier, location: fields.location || undefined },
  });

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

  const result = await requestClaim(meta.id, user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/${slug}`);
  return { ok: true };
}

// ─── community vouch ──────────────────────────────────────────────────────────

export async function vouchForDossier(slug: string): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to vouch for this artist." };

  const meta = await getDossierMeta(slug);
  if (!meta) return { error: "Dossier not found." };

  const result = await vouchForProfile(meta.id, user.id);
  if (!result.ok) return { error: result.error };

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

  const meta = await getDossierMeta(slug);
  if (!meta) return { error: "Dossier not found." };

  if (action === "verify" || action === "unverify") {
    const result = await setProfileVerified(meta.id, user.id, action === "verify");
    if (!result.ok) return { error: result.error };
  } else if (action === "approve_claim") {
    const result = await approveClaim(meta.id, user.id);
    if (!result.ok) return { error: result.error };
  }

  revalidatePath(`/${slug}`);
  return { ok: true };
}
