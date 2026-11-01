import { sanitizeRichText } from "@elkdonis/utils";
import type { NetworkProfile } from "@/app/studio/_components/artist-profile-form";

// `users.bio` is written as plain text by some apps and as HTML by others
// (IFAC's live editor saves what its rich-text trait produces), so the
// marketplace has to read both.
const HAS_TAG = /<[a-z][^>]*>/i;

/** Whether the bio can be edited here as plain text without losing markup. */
export function isPlainBio(bio: string | null | undefined): boolean {
  return !bio || !HAS_TAG.test(bio);
}

/** The profile bio as sanitized HTML: HTML passes through the sanitizer, plain text becomes paragraphs. */
export function profileBioHtml(bio: string | null | undefined): string {
  if (!bio?.trim()) return "";
  if (!isPlainBio(bio)) return sanitizeRichText(bio);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = bio
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${p.split("\n").map(esc).join("<br>")}</p>`)
    .join("\n");
  return sanitizeRichText(html);
}

/** Map a person's profile (from `getSellerProfile` or a person's store) to what the store form shows. */
export function toNetworkProfile(
  p: {
    displayName?: string | null;
    headline?: string | null;
    city?: string | null;
    photoUrl?: string | null;
    bio?: string | null;
    slug?: string | null;
  } | null,
  artdirectUrl: string
): NetworkProfile {
  const plain = isPlainBio(p?.bio);
  return {
    displayName: p?.displayName ?? null,
    headline: p?.headline ?? null,
    city: p?.city ?? null,
    photoUrl: p?.photoUrl ?? null,
    bioText: plain ? (p?.bio ?? null) : null,
    bioHtml: profileBioHtml(p?.bio),
    bioEditable: plain,
    profileUrl: p?.slug ? `${artdirectUrl}/${p.slug}` : null,
  };
}
