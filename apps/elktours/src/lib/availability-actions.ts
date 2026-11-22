"use server";
// Offer availability (hub, 2026-11-19): an owner or guide lists the days ahead they are free to guide or to host an
// experience (guide_availability, migration 279), and the owners are emailed (developer's choice, 2026-11-19).

import { headers } from "next/headers";
import { db } from "@elkdonis/db";
import { publicOriginFrom } from "@elkdonis/checkout/booking";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { parisToday } from "@/lib/schedule-plan";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export type DayPart = "morning" | "afternoon" | "evening";
export type Offer = "guide" | "experience";
const PARTS: DayPart[] = ["morning", "afternoon", "evening"];
const OFFERS: Offer[] = ["guide", "experience"];

export interface AvailabilityDay {
  day: string;
  /** Empty = the whole day. */
  parts: DayPart[];
  offers: Offer[];
  note: string | null;
}

export interface AvailabilitySheet {
  today: string;
  mine: AvailabilityDay[];
  /** Owners: everyone's days, with names (the office view). Guides: null. */
  team: Array<AvailabilityDay & { userId: string; name: string }> | null;
}

const dayOf = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

function mapDay(r: Row): AvailabilityDay {
  return {
    day: dayOf(r.day),
    parts: ((r.parts as string[] | null) ?? []).filter((p): p is DayPart => (PARTS as string[]).includes(p)),
    offers: ((r.offers as string[] | null) ?? []).filter((o): o is Offer => (OFFERS as string[]).includes(o)),
    note: (r.note as string | null) ?? null,
  };
}

/** The viewer's days from today on (and, for owners, everyone's). */
export async function getAvailabilitySheet(): Promise<AvailabilitySheet> {
  const viewer = await requireOrgEditor();
  const today = parisToday();
  const mine = (await db`
    SELECT day, parts, offers, note FROM guide_availability
    WHERE org_id = ${ORG} AND user_id = ${viewer.userId} AND day >= ${today}::date
    ORDER BY day LIMIT 400
  `) as unknown as Row[];
  let team: AvailabilitySheet["team"] = null;
  if (viewer.role === "owner") {
    const rows = (await db`
      SELECT a.day, a.parts, a.offers, a.note, a.user_id, COALESCE(u.display_name, u.email) AS name
      FROM guide_availability a JOIN users u ON u.id = a.user_id
      WHERE a.org_id = ${ORG} AND a.day >= ${today}::date
      ORDER BY a.day, name LIMIT 1000
    `) as unknown as Row[];
    team = rows.map((r) => ({ ...mapDay(r), userId: r.user_id as string, name: (r.name as string) ?? "Someone" }));
  }
  return { today, mine: mine.map(mapDay), team };
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pretty = (day: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`));

/**
 * Replace the viewer's days from today on with `days` (a day left out is no longer offered), then, when
 * `alertOffice`, email the owners the days that are new or changed.
 */
export async function saveAvailabilityDaysAction(
  days: AvailabilityDay[],
  alertOffice: boolean
): Promise<{ ok: true; saved: number; emailed: number } | { ok: false; error: string }> {
  const viewer = await requireOrgEditor();
  const today = parisToday();
  const clean = new Map<string, AvailabilityDay>();
  for (const d of (days ?? []).slice(0, 400)) {
    if (!DAY.test(d?.day ?? "") || d.day < today) continue;
    clean.set(d.day, {
      day: d.day,
      parts: [...new Set((d.parts ?? []).filter((p) => (PARTS as string[]).includes(p)))],
      offers: [...new Set((d.offers ?? []).filter((o) => (OFFERS as string[]).includes(o)))].length ? [...new Set(d.offers.filter((o) => (OFFERS as string[]).includes(o)))] : ["guide"],
      note: typeof d.note === "string" && d.note.trim() ? d.note.trim().slice(0, 300) : null,
    });
  }
  const list = [...clean.values()].sort((a, b) => a.day.localeCompare(b.day));

  const before = (await db`
    SELECT day, parts, offers, note FROM guide_availability WHERE org_id = ${ORG} AND user_id = ${viewer.userId} AND day >= ${today}::date
  `) as unknown as Row[];
  const prev = new Map(before.map((r) => [dayOf(r.day), mapDay(r)]));
  const changed = list.filter((d) => JSON.stringify(prev.get(d.day) ?? null) !== JSON.stringify(d));

  try {
    await db.begin(async (tx) => {
      const keep = list.map((d) => d.day);
      await tx`
        DELETE FROM guide_availability
        WHERE org_id = ${ORG} AND user_id = ${viewer.userId} AND day >= ${today}::date
          AND NOT (day = ANY(${keep}::date[]))
      `;
      for (const d of list) {
        await tx`
          INSERT INTO guide_availability (org_id, user_id, day, parts, offers, note)
          VALUES (${ORG}, ${viewer.userId}, ${d.day}::date, ${d.parts}::text[], ${d.offers}::text[], ${d.note})
          ON CONFLICT (org_id, user_id, day) DO UPDATE SET parts = EXCLUDED.parts, offers = EXCLUDED.offers, note = EXCLUDED.note, updated_at = NOW()
        `;
      }
    });
  } catch (err) {
    console.error("[elktours] saveAvailabilityDaysAction:", err);
    return { ok: false, error: "Could not save your days." };
  }

  let emailed = 0;
  if (alertOffice && changed.length > 0) {
    const [me] = (await db`SELECT COALESCE(display_name, email) AS name, email FROM users WHERE id = ${viewer.userId}`) as unknown as Row[];
    const owners = (await db`
      SELECT DISTINCT u.email FROM users u JOIN user_organizations uo ON uo.user_id = u.id
      WHERE uo.org_id = ${ORG} AND uo.role = 'owner' AND u.email IS NOT NULL AND u.id <> ${viewer.userId}
    `) as unknown as Row[];
    const to = [...new Set(owners.map((r) => r.email as string))].slice(0, 6);
    const who = escape((me?.name as string) ?? "A guide");
    const rows = changed
      .map((d) => {
        const parts = d.parts.length ? d.parts.join(", ") : "all day";
        const offers = d.offers.map((o) => (o === "guide" ? "guide" : "host an experience")).join(" or ");
        return `<tr><td style="padding:4px 12px 4px 0">${escape(pretty(d.day))}</td><td style="padding:4px 12px 4px 0">${escape(parts)}</td><td style="padding:4px 12px 4px 0">${escape(offers)}</td><td style="padding:4px 0">${escape(d.note ?? "")}</td></tr>`;
      })
      .join("");
    // Built from the request (publicOrigin rule): request.nextUrl.origin reports 0.0.0.0 here.
    const origin = publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL);
    const html = `<p>${who} is free on these days:</p><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}</table><p>Offer a tour on these days from the hub: <a href="${origin}/hub">${escape(origin.replace(/^https?:\/\//, ""))}/hub</a>.</p>`;
    try {
      const { sendEmail } = await import("@elkdonis/email");
      const results = await Promise.all(
        to.map((addr) =>
          sendEmail({ to: addr, subject: `${(me?.name as string) ?? "A guide"} is free on ${changed.length} day${changed.length === 1 ? "" : "s"}`, html, orgId: ORG, kind: "notification", replyTo: (me?.email as string) ?? undefined }).then(
            () => 1,
            (err: unknown) => {
              console.error("[elktours] availability email:", err);
              return 0;
            }
          )
        )
      );
      emailed = results.reduce((a: number, b: number) => a + b, 0);
    } catch (err) {
      console.error("[elktours] availability email:", err);
    }
  }
  return { ok: true, saved: list.length, emailed };
}
