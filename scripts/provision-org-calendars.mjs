#!/usr/bin/env node
/**
 * Provision one CalDAV calendar per organization, and share it to that org's
 * members.
 *
 * Mirrors provision-org-deck-boards.mjs — same doctrine, same two-way member
 * reconciliation — with one difference established by live testing:
 *
 *   A CIRCLE CANNOT RECEIVE A CALENDAR SHARE.
 *
 * A DAV share to `principal:principals/circles/<id>` returns HTTP 200 and
 * writes nothing to `oc_dav_shares`. Every share variant returns 200, so the
 * status code tells you nothing — this script re-reads the share list and
 * reports what actually persisted. Shares therefore go out one per user
 * principal, with `user_organizations` as the membership authority. (The
 * service account also gets 403 reading circle membership over OCS, so it
 * could not use the Circle as the source even if the share worked.)
 *
 * Note the shares land as read-WRITE whatever this asks for: on this instance
 * `<o:read/>`, `<o:read-write/>` and omitting the element all produce
 * `access = 3`. Members can therefore edit the mirror, and such an edit is
 * lost on the next push from the app.
 *
 * Deliberately NOT shared with the EAC_Network group: that would put every
 * org's calendar in every member's client, which is the same mistake the deck
 * script's header warns about for boards.
 *
 * Usage:
 *   node scripts/provision-org-calendars.mjs [orgId ...] [--dry-run] [--sync-events]
 *
 * --sync-events also pushes every published, dated thread into the calendar.
 * Off by default: provisioning is cheap and idempotent, while a full push is
 * one CalDAV PUT per event and belongs to an explicit backfill, not to every
 * membership reconciliation.
 */

import { createRequire } from "node:module";

const require = createRequire(new URL("../packages/db/package.json", import.meta.url));
const postgres = require("postgres");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SYNC_EVENTS = args.includes("--sync-events");
const ORG_FILTER = args.filter((a) => !a.startsWith("--"));

const {
  DATABASE_URL,
  NEXTCLOUD_URL,
  NEXTCLOUD_ADMIN_USER: NC_USER,
  NEXTCLOUD_ADMIN_PASSWORD: NC_PASS,
} = process.env;

for (const [name, value] of Object.entries({
  DATABASE_URL,
  NEXTCLOUD_URL,
  NEXTCLOUD_ADMIN_USER: NC_USER,
  NEXTCLOUD_ADMIN_PASSWORD: NC_PASS,
})) {
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
}

const AUTH = `Basic ${Buffer.from(`${NC_USER}:${NC_PASS}`).toString("base64")}`;
const calUrl = (uri) =>
  `${NEXTCLOUD_URL}/remote.php/dav/calendars/${encodeURIComponent(NC_USER)}/${encodeURIComponent(uri)}`;

const xml = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function dav(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: AUTH,
      ...(body ? { "Content-Type": "application/xml; charset=utf-8" } : {}),
      ...headers,
    },
    ...(body ? { body } : {}),
  });
  return { status: res.status, text: await res.text().catch(() => "") };
}

async function calendarExists(uri) {
  const { status } = await dav("PROPFIND", calUrl(uri), null, { Depth: "0" });
  return status >= 200 && status < 300;
}

async function createCalendar(uri, displayName) {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set><D:prop>
    <D:displayname>${xml(displayName)}</D:displayname>
    <C:calendar-description>${xml(`Events published by ${displayName}.`)}</C:calendar-description>
    <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
  </D:prop></D:set>
</C:mkcalendar>`;
  const { status } = await dav("MKCALENDAR", calUrl(uri), body);
  // 405/409 mean it is already there, which is the state we wanted.
  if (status === 201 || status === 405 || status === 409) return true;
  throw new Error(`MKCALENDAR ${uri} -> ${status}`);
}

async function listShares(uri) {
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:oc="http://owncloud.org/ns">
  <D:prop><oc:invite/></D:prop>
</D:propfind>`;
  const { status, text } = await dav("PROPFIND", calUrl(uri), body, { Depth: "0" });
  if (status !== 207) return [];
  const uids = new Set();
  for (const m of text.matchAll(/principal:principals\/users\/([^<\s]+)/g)) {
    uids.add(decodeURIComponent(m[1]));
  }
  return [...uids];
}

async function share(uri, uid, remove = false) {
  const href = `principal:principals/users/${uid}`;
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<o:share xmlns:D="DAV:" xmlns:o="http://owncloud.org/ns">
  ${remove ? `<o:remove><D:href>${xml(href)}</D:href></o:remove>`
           : `<o:set><D:href>${xml(href)}</D:href><o:read/></o:set>`}
</o:share>`;
  await dav("POST", calUrl(uri), body);
}

/**
 * Escape a text value for iCalendar (RFC 5545 §3.3.11).
 * Mirrors escapeICalText in packages/nextcloud/src/calendar.ts — this script
 * deliberately imports nothing from the repo, the same way the deck and circle
 * provisioners don't.
 */
const ics = (v) =>
  String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

const stamp = (d) =>
  new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const RRULE = { DAILY: "FREQ=DAILY", WEEKLY: "FREQ=WEEKLY", MONTHLY: "FREQ=MONTHLY" };

/** PUT one thread as a VEVENT. The UID is the thread id, so this upserts. */
async function pushEvent(uri, t) {
  const start = new Date(t.scheduled_at);
  const end = new Date(start.getTime() + (t.duration_minutes ?? 60) * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elkdonis Arts Collective//EAC Meetings//EN",
    "BEGIN:VEVENT",
    `UID:${t.id}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${ics(t.title)}`,
    "STATUS:CONFIRMED",
  ];
  if (t.body) {
    lines.push(`DESCRIPTION:${ics(t.body.replace(/<[^>]*>/g, " ").slice(0, 2000))}`);
  }
  if (t.location) lines.push(`LOCATION:${ics(t.location)}`);
  if (t.meeting_url) lines.push(`URL:${t.meeting_url}`);
  const rule = RRULE[t.recurrence_pattern];
  if (rule) {
    lines.push(
      `RRULE:${rule}${t.recurrence_until ? `;UNTIL=${stamp(t.recurrence_until)}` : ""}`
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  const res = await fetch(`${calUrl(uri)}/${encodeURIComponent(t.id)}.ics`, {
    method: "PUT",
    headers: { Authorization: AUTH, "Content-Type": "text/calendar; charset=utf-8" },
    body: lines.join("\r\n"),
  });
  return res.status;
}

const sql = postgres(DATABASE_URL, { onnotice: () => {} });

try {
  const orgs = await sql`
    SELECT id, name, calendar_uri FROM organizations
    ${ORG_FILTER.length ? sql`WHERE id = ANY(${ORG_FILTER})` : sql``}
    ORDER BY id
  `;

  for (const org of orgs) {
    const uri = org.calendar_uri || org.id.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    if (org.calendar_uri && (await calendarExists(uri))) {
      console.log(`= ${org.id}: calendar "${uri}" already`);
    } else if (DRY_RUN) {
      console.log(`~ ${org.id}: would create calendar "${uri}"`);
    } else {
      await createCalendar(uri, org.name);
      await sql`
        UPDATE organizations
        SET calendar_uri = ${uri}, calendar_synced_at = NOW()
        WHERE id = ${org.id}
      `;
      console.log(`+ ${org.id}: created calendar "${uri}"`);
    }

    // ── member reconciliation, both directions ──────────────────────────────
    const members = await sql`
      SELECT DISTINCT u.nextcloud_user_id AS uid
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      WHERE uo.org_id = ${org.id} AND u.nextcloud_user_id IS NOT NULL
    `;
    const wanted = new Set(members.map((m) => m.uid));

    if (DRY_RUN) {
      console.log(`  ~ would reconcile ${wanted.size} member share(s)`);
      continue;
    }

    const current = new Set(await listShares(uri));

    for (const uid of wanted) {
      if (current.has(uid)) continue;
      await share(uri, uid);
      console.log(`  + shared with ${uid}`);
    }
    for (const uid of current) {
      if (wanted.has(uid)) continue;
      await share(uri, uid, true);
      console.log(`  - revoked ${uid}`);
    }

    // Re-read rather than trust the 200s. This is the check that catches a
    // share that reported success and persisted nothing.
    const after = new Set(await listShares(uri));
    const missing = [...wanted].filter((uid) => !after.has(uid));
    if (missing.length) {
      console.warn(
        `  ! ${org.id}: ${missing.length} share(s) did not persist: ${missing.join(", ")}`
      );
    } else if (wanted.size) {
      console.log(`  ✓ ${wanted.size} member share(s) confirmed`);
    } else {
      console.log(`  · no members with Nextcloud accounts`);
    }

    if (SYNC_EVENTS) {
      const events = await sql`
        SELECT id, title, body, location, meeting_url, scheduled_at,
               duration_minutes, recurrence_pattern, recurrence_until
        FROM threads
        WHERE org_id = ${org.id}
          AND kind IN ('event', 'meeting', 'workshop')
          AND status = 'published'
          AND scheduled_at IS NOT NULL
      `;
      let pushed = 0;
      for (const event of events) {
        const status = await pushEvent(uri, event);
        if (status === 201 || status === 204) pushed++;
        else console.warn(`  ! ${event.id} -> ${status}`);
      }
      console.log(`  ↑ ${pushed}/${events.length} event(s) pushed`);
    }

    await sql`
      UPDATE organizations SET calendar_synced_at = NOW() WHERE id = ${org.id}
    `;
  }
} finally {
  await sql.end();
}
