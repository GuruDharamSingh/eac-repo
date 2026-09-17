// ============================================================================
// @elkdonis/newsletter — a visual email composer, org-agnostic.
//
// Deliberately SEPARATE from the Silex site editor. A newsletter is a
// different kind of document: table layout, inline CSS, ~600px, no script,
// because email clients support almost nothing else. Loading the newsletter
// preset over a live website project in Silex and saving would rewrite that
// project — so this is its own editor instance, its own storage key, and its
// own output pipeline.
//
// Three entry points, split so a server route never pulls GrapesJS into its
// bundle and a client component never pulls the database into the browser:
//
//   @elkdonis/newsletter          types (this file) — safe anywhere
//   @elkdonis/newsletter/editor   the client editor
//   @elkdonis/newsletter/server   storage, recipients, sending
// ============================================================================

/** Slugs are used in a URL and in a storage key, so keep them boring. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,48}$/;

export function isValidNewsletterSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** `site_config.key` for one newsletter, mirroring the `puck:<slug>` precedent. */
export function newsletterKey(slug: string): string {
  return `newsletter:${slug}`;
}

export interface Newsletter {
  slug: string;
  /** Subject line, and the name shown in the list. */
  title: string;
  /**
   * GrapesJS project data, stored verbatim. Keeping the editor's own
   * documented shape rather than translating it means that if the editor is
   * ever replaced, these are still readable data rather than an export
   * problem — the same argument the Puck store makes.
   */
  project: unknown;
  /**
   * The rendered email: HTML with CSS already inlined by the editor, which is
   * the only form email clients reliably render. Stored at save time rather
   * than produced at send time, because inlining happens in the browser (the
   * preset runs `juice` there) and the send path has no editor.
   */
  html: string;
  updatedAt: string | null;
  sentAt: string | null;
  /** How many addresses the last real send went to. */
  sentCount: number;
}

export type NewsletterSummary = Omit<Newsletter, "project" | "html">;

export interface SendResult {
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
  /**
   * Why a real send was refused, itemised.
   *
   * Carried alongside `error` rather than instead of it so a caller that only
   * shows a message still shows a useful one, while the editor can list each
   * problem and offer to send anyway.
   */
  problems?: {
    brokenLinks: { id: string; label: string | null }[];
    placeholders: string[];
  };
}

/**
 * The origin a recipient can actually reach.
 *
 * ── Why this is not just the env var ────────────────────────────────────────
 *
 * `NEXT_PUBLIC_APP_URL` is `http://localhost:3015` in this deployment (it
 * defaults to a localhost port in docker-compose for every app), and the send
 * route preferred it over the request. Every unsubscribe link in a newsletter
 * would therefore have pointed at localhost — unreachable for anyone who
 * received it. The package already refuses to send without a working
 * unsubscribe SECRET, on the grounds that a letter nobody can opt out of is a
 * failure that lands on the recipient; an unsubscribe URL nobody can open is
 * the same failure by a different route.
 *
 * So a configured value is used only when it is one a stranger could open. A
 * loopback or private address means the configuration is a developer default
 * and the forwarded host is the truth.
 */
export function publicBaseUrl(
  configured: string | undefined,
  forwardedProto: string | null,
  forwardedHost: string | null
): string {
  const isLocal = (value: string) =>
    /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
      value
    );

  const fromRequest = forwardedHost
    ? `${(forwardedProto ?? "https").split(",")[0].trim()}://${forwardedHost.split(",")[0].trim()}`
    : "";

  if (configured && !isLocal(configured)) return configured.replace(/\/+$/, "");
  if (fromRequest && !isLocal(fromRequest)) return fromRequest.replace(/\/+$/, "");
  // Both are local: a developer running the thing. Prefer the request so links
  // at least resolve on the machine they were made on.
  return (fromRequest || configured || "").replace(/\/+$/, "");
}

export { shapeForKind, threadCardMarkup } from "./blocks";
export type { ThreadCardShape, ThreadCardFields } from "./blocks";

export {
  STARTER_LETTERS,
  renderStarter,
  unknownStarterBlocks,
  starterModeConflicts,
} from "./starters";
export type { StarterLetter } from "./starters";
export {
  NEUTRAL_PALETTE,
  NEUTRAL_DARK_PALETTE,
  paletteFor,
  onAccentFor,
} from "./blocks";
export type { PaletteChoice, BlockPalette } from "./blocks";
