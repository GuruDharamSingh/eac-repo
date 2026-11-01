import { NextRequest, NextResponse } from "next/server";
import { db } from "@elkdonis/db";
import { getMeetingSeries } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { answerSeriesWeek, verifyComing, weekTitle, whenLine } from "@/lib/series-mail";
import { notePage } from "@/lib/note-page";

/**
 * "I'm coming" from a subscriber letter (2026-10-10). The link names the
 * week and the account and carries an HMAC of both (`comingUrl`), so it
 * works on a phone that is not signed in.
 *
 * GET shows the week and one button; POST records the yes, sends the usual
 * confirmation and host notice (`answerSeriesWeek`), and goes to the week's
 * page. Two steps rather than one because mail scanners open links: a GET
 * that wrote would sign people up for weeks they never chose.
 */
export const dynamic = "force-dynamic";

type Params = { s: string; at: string; u: string; t: string };

async function resolve(p: Params) {
  if (!p.s || !p.at || !p.u || !p.t) return null;
  const at = new Date(p.at);
  if (Number.isNaN(at.getTime())) return null;
  const iso = at.toISOString();
  if (!verifyComing(p.s, iso, p.u, p.t)) return null;
  const series = await getMeetingSeries(siteConfig.orgId, { threadId: p.s }, { count: 12, pastCount: 0 }).catch(() => null);
  const week = series?.sessions.find((w) => w.at === iso);
  if (!series || !week) return null;
  return { series, week };
}

function broken() {
  return notePage(
    { title: "This link didn't work", lines: ["It may have been altered in transit, or the session has moved. The series page has the current dates."] },
    400
  );
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const p: Params = { s: q.get("s") ?? "", at: q.get("at") ?? "", u: q.get("u") ?? "", t: q.get("t") ?? "" };
  const found = await resolve(p);
  if (!found) return broken();
  const { series, week } = found;
  const page = `/series/${series.slug}/${week.number}`;
  if (week.isPast || !week.isPublished) {
    return notePage({
      title: week.isPast ? "That session has passed" : "That session is not open yet",
      lines: [weekTitle(series, week), whenLine(series, week.at)],
      link: { label: `See ${series.title}`, href: `/series/${series.slug}` },
    });
  }
  return notePage({
    title: "Coming to this session?",
    lines: [weekTitle(series, week), whenLine(series, week.at), "We'll email your confirmation with the join link."],
    form: { action: "/api/series/coming", fields: p, button: "I'm coming" },
    link: { label: "See the session first", href: page },
  });
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const get = (k: string) => (typeof form?.get(k) === "string" ? String(form!.get(k)) : "");
  const p: Params = { s: get("s"), at: get("at"), u: get("u"), t: get("t") };
  const found = await resolve(p);
  if (!found) return broken();
  const { series, week } = found;
  if (week.isPast || !week.isPublished) return broken();

  const [user] = await db<Array<{ email: string | null }>>`SELECT email FROM users WHERE id = ${p.u}::uuid`;
  if (!user) return broken();
  const result = await answerSeriesWeek({ series, week, userId: p.u, email: user.email, going: true });
  if (!result.ok) {
    return notePage(
      { title: "We couldn't add you", lines: [result.error ?? "The session may be full."], link: { label: "See the session", href: `/series/${series.slug}/${week.number}` } },
      409
    );
  }
  return NextResponse.redirect(new URL(`/series/${series.slug}/${week.number}`, `https://${siteConfig.domain}`), 303);
}
