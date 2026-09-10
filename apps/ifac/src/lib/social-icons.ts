/**
 * Which downloaded mark in /public/social belongs to a social link.
 *
 * Matched on the URL's host rather than the label, because labels are
 * editable through the CMS (and differ between the header and the home page
 * anyway), so matching on them would silently stop working the moment
 * someone renamed one. Returns null for anything unrecognised, which renders
 * the link as its label instead of an empty hit area.
 *
 * Shared by the site header and the home page's social row so a new platform
 * only has to be added once.
 */
export function socialIcon(href: string): string | null {
  if (href.startsWith("mailto:")) return "email";
  let host: string;
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host.endsWith("facebook.com") || host.endsWith("fb.com")) return "facebook";
  if (host.endsWith("bsky.app")) return "bluesky";
  if (host.endsWith("threads.net") || host.endsWith("threads.com")) return "threads";
  if (host.endsWith("twitter.com") || host === "x.com") return "x";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("youtube.com") || host.endsWith("youtu.be")) return "youtube";
  return null;
}
