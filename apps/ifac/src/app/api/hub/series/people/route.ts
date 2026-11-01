import { NextRequest, NextResponse } from "next/server";
import { listSeriesPeople, type SeriesPerson } from "@elkdonis/services";
import { getApiEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * The people of one series, for the planner's Manage tab ("Email list")
 * (docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md §2–3).
 *
 *   GET ?threadId=…              JSON: { seriesId, slug, title, counts, people }
 *   GET ?threadId=…&format=csv   the same rows as a CSV attachment
 *
 * Organisers only (owner or guide, `getApiEditor`): the list carries email
 * addresses. Others get 403. `listSeriesPeople` is scoped to this org and
 * returns null for a thread of another org or one that is not a series,
 * which answers 404. Read-only.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const viewer = await getApiEditor();
  if (!viewer) return NextResponse.json({ error: "Organisers only" }, { status: 403, headers: NO_STORE });

  const threadId = request.nextUrl.searchParams.get("threadId");
  if (!threadId) return NextResponse.json({ error: "threadId required" }, { status: 400, headers: NO_STORE });

  const list = await listSeriesPeople(siteConfig.orgId, threadId);
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const name = (list.slug || "series").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "series";
    return new NextResponse(toCsv(list.people), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-people.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return NextResponse.json(list, { headers: NO_STORE });
}

const COLUMNS: Array<[string, (p: SeriesPerson) => string]> = [
  ["Name", (p) => p.name],
  ["Email", (p) => p.email],
  ["Subscribed", (p) => (p.subscribed ? "yes" : "no")],
  ["Weeks coming", (p) => String(p.weeksComing)],
  ["Weeks hosting", (p) => String(p.weeksHosting)],
  ["First seen", (p) => p.firstSeen ?? ""],
  ["Last week", (p) => p.lastWeekAt ?? ""],
  ["Unsubscribed from IFAC email", (p) => (p.orgUnsubscribed ? "yes" : "no")],
];

/**
 * One cell. A value a spreadsheet would read as a formula (starting with
 * = + - @, or a tab or carriage return) gets a leading apostrophe; every cell
 * is quoted, with inner quotes doubled.
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(people: SeriesPerson[]): string {
  const lines = [COLUMNS.map(([h]) => cell(h)).join(",")];
  for (const p of people) lines.push(COLUMNS.map(([, get]) => cell(get(p))).join(","));
  // A byte-order mark so Excel opens the file as UTF-8 (names with accents).
  return "﻿" + lines.join("\r\n") + "\r\n";
}
