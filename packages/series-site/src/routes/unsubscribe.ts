import { NextRequest } from "next/server";
import { getMeetingSeries, unsubscribeSeriesByEmail } from "@elkdonis/services";
import { createSeriesMail } from "../lib/series-mail";
import { createNotePage } from "../lib/note-page";
import type { SeriesSite } from "../config";

export function unsubscribeRoutes(site: SeriesSite) {
  const { verifySeriesUnsubscribe } = createSeriesMail(site);
  const { notePage } = createNotePage(site);

/**
 * One-click unsubscribe from a series, from the link in a subscriber letter
 * (`seriesUnsubscribeUrl`). No sign-in: the link carries the address and an
 * HMAC of it, as the newsletter's /unsubscribe does. Removes the
 * `subscribed` row on the series' own thread; RSVPs to single weeks are left
 * alone. Says the
 * same thing whether or not a row existed.
 */

async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const seriesId = q.get("s") ?? "";
  const email = q.get("e") ?? "";
  const token = q.get("t") ?? "";
  const valid = Boolean(seriesId && email && token && verifySeriesUnsubscribe(seriesId, email, token));
  const series = valid ? await getMeetingSeries(site.orgId, { threadId: seriesId }, { count: 1 }).catch(() => null) : null;
  if (!valid || !series) {
    return notePage(
      {
        title: "This link didn't work",
        lines: ["It may have been altered in transit, or the series has ended. Reply to any of our letters and we'll take you off the list by hand."],
      },
      400
    );
  }
  await unsubscribeSeriesByEmail(site.orgId, series.id, email);
  return notePage({
    title: "Unsubscribed",
    lines: [
      `${email} will not get any more letters about ${series.title}.`,
      "Weeks you already said you're coming to stay as they are, and your account still works.",
    ],
    link: { label: `Back to ${series.title}`, href: `/series/${series.slug}` },
  });
}

  return { GET };
}
