import "server-only";
import type { NewsletterAudience } from "@elkdonis/newsletter";
import type { UnsubscribeUrl } from "@elkdonis/newsletter/server";
import { SITE_ORIGIN, seriesUnsubscribeUrl } from "@/lib/series-mail";

/**
 * Mailings to one series (design step 6, docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md
 * §2 "Series newsletter"; developer course change 2026-10-10).
 *
 * A mailing is a newsletter issue addressed to the series' subscribers
 * (`thread_rsvps.status = 'subscribed'` on the series thread, minus org
 * `unsubscribed` contacts; `listRecipients` in @elkdonis/newsletter). It is
 * stored as `site_config` `series-mail:<seriesId>:<slug>`, so it never appears
 * among IFAC's own `newsletter:<slug>` issues. IFAC has no org newsletter
 * editor.
 *
 * Pages: the "Mailings to this series" section of `/manage/email/series/[id]`
 * and the editor at `/manage/email/series/[id]/mailings/[slug]`. API:
 * `/api/newsletter/series/[id]/[slug]` (PUT/DELETE) and `.../send` (POST),
 * owner or guide. The caller checks the id with `findIfacSeries` first.
 */

export function seriesAudience(seriesId: string): NewsletterAudience {
  return { kind: "series", threadId: seriesId };
}

/**
 * Links in a mailing point at ifacgroup.com, not at the request's host: the
 * same origin the series' other letters use (`SITE_ORIGIN`), and never a
 * localhost default from a preview or a container.
 */
export const MAILING_BASE_URL = SITE_ORIGIN;

/**
 * The footer link: the series' one-click unsubscribe
 * (`/api/series/unsubscribe`, `seriesUnsubscribeUrl`), which removes the
 * subscription and leaves single-week RSVPs alone.
 */
export function mailingUnsubscribeUrl(seriesId: string): UnsubscribeUrl {
  return (email) => seriesUnsubscribeUrl(MAILING_BASE_URL, seriesId, email);
}

export function mailingsHref(seriesId: string, slug?: string): string {
  const base = `/manage/email/series/${encodeURIComponent(seriesId)}`;
  return slug ? `${base}/mailings/${encodeURIComponent(slug)}` : `${base}#mailings`;
}

export function mailingApi(seriesId: string, slug: string): string {
  return `/api/newsletter/series/${encodeURIComponent(seriesId)}/${encodeURIComponent(slug)}`;
}

/** A URL-safe slug from a subject line, as the other newsletter hosts make it. */
export function mailingSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
