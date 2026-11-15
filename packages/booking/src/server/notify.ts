/**
 * Booking mail. A failed email never undoes a state change: every send is
 * caught and logged. Links point at the site the booking was made on
 * (`bookings.site_url`, migration 266), else the network hub.
 */

import { formatWhen, zoneAbbreviation } from "../core/time";

const NETWORK_URL = (
  process.env.ARTS_COLLECTIVE_URL ??
  process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ??
  "https://arts-collective.com"
).replace(/\/$/, "");

export function siteBase(siteUrl: string | null | undefined): string {
  return (siteUrl || NETWORK_URL).replace(/\/$/, "");
}

/** The booker's private page (no account needed). */
export function bookerUrl(siteUrl: string | null | undefined, token: string): string {
  return `${siteBase(siteUrl)}/bookings/${encodeURIComponent(token)}`;
}

/** The host's list of their bookings on that site. */
export function hostUrl(siteUrl: string | null | undefined): string {
  return `${siteBase(siteUrl)}/bookings`;
}

export function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function when(iso: string, timeZone: string): string {
  return `${formatWhen(iso, timeZone)} (${zoneAbbreviation(iso, timeZone)})`;
}

export function timesList(times: string[], timeZone: string): string {
  return `<ul>${times.map((t) => `<li>${esc(when(t, timeZone))}</li>`).join("")}</ul>`;
}

export function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;padding:10px 18px;background:#1f1f1f;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">${esc(label)}</a>`;
}

export async function notify(
  to: string | null | undefined,
  subject: string,
  paragraphs: string[],
  orgId: string,
  replyTo?: string | null
): Promise<void> {
  if (!to) return;
  try {
    const { sendEmail } = await import("@elkdonis/email");
    const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#1f1f1f">${paragraphs
      .filter(Boolean)
      .map((p) => (p.startsWith("<ul>") ? p : `<p>${p}</p>`))
      .join("")}</div>`;
    await sendEmail({ to, subject, html, orgId, kind: "order", ...(replyTo ? { replyTo } : {}) });
  } catch (err) {
    console.error(`[booking] email "${subject}" failed:`, err);
  }
}
