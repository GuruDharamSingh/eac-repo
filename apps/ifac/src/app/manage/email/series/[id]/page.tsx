import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isValidNewsletterSlug } from "@elkdonis/newsletter";
import { listNewsletters, listRecipients } from "@elkdonis/newsletter/server";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";
import { requireIfacManager } from "@/lib/manage-auth";
import { findIfacSeries, loadSeriesLetters } from "@/lib/series-letters-store";
import { mailingSlug, mailingsHref, seriesAudience } from "@/lib/series-letters-mailings";
import { SeriesLettersHost } from "./SeriesLettersHost";

export const metadata: Metadata = { title: "Series email — IFAC" };
export const dynamic = "force-dynamic";

/**
 * One series' letters (design step 4,
 * docs/open/SERIES_EMAIL_DESIGN_2026-10-10.md): the confirmation, the four
 * reminders and the host notice, each either IFAC's letter or this series'
 * own version (`<key>:<seriesId>[:<purpose>]`). Gated like /manage/email.
 * Saves go through `/api/hub/email/<key>?series=&purpose=`, which admits
 * owners and guides only.
 *
 * "Mailings to this series" (design step 6, 2026-10-10) lists the series'
 * newsletter issues and starts new ones; the editor is
 * `./mailings/[slug]` (lib/series-letters-mailings.ts).
 */
export default async function SeriesEmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireIfacManager(`/manage/email/series/${encodeURIComponent(id)}`);
  const series = await findIfacSeries(id);
  if (!series) notFound();
  const audience = seriesAudience(series.id);
  // Mailings to the series' subscribers (design step 6): stored as
  // `series-mail:<id>:<slug>`, never among IFAC's `newsletter:` issues.
  const [data, mailings, subscribers] = await Promise.all([
    loadSeriesLetters(series),
    listNewsletters(siteConfig.orgId, audience),
    listRecipients(siteConfig.orgId, audience),
  ]);
  const customised = data.templates.filter((t) => t.resetLabel).length;

  return (
    <section className="manage-email manage-series-email" data-series-letters={series.id}>
      <p className="kicker">Series email</p>
      <h2>{series.title}</h2>
      <p className="body-copy">
        {customised === 0
          ? "Every letter of this series uses the IFAC letter."
          : `${customised} of this series' letters ${customised === 1 ? "is" : "are"} customised; the rest use the IFAC letter.`}{" "}
        A change here applies to this series only.
      </p>
      <p className="body-copy">
        <a href={`/hub/series/${encodeURIComponent(series.id)}`}>Open the series planner</a>
        {" · "}
        <a href="/manage/email?tab=letters">All IFAC letters</a>
        {" · "}
        <a href="#mailings">Write a mailing to this series&apos; subscribers</a>
      </p>
      <div className="hub-email-workspace">
        <SeriesLettersHost data={data} seriesId={series.id} />
      </div>

      <section id="mailings" className="admin-panel manage-series-mailings" data-series-mailings={series.id}>
        <h2>Mailings to this series</h2>
        <p className="body-copy">
          A letter you write and send once, to the {subscribers.length}{" "}
          {subscribers.length === 1 ? "person" : "people"} subscribed to {series.title}. People who only said
          they are coming to one week, and anyone who unsubscribed from IFAC&rsquo;s mail, are not included.
          Each copy ends with a link to unsubscribe from this series.
        </p>
        <form action={createMailing} className="field-grid">
          <input type="hidden" name="seriesId" value={series.id} />
          <div className="field">
            <label htmlFor="mailing-title">Subject of a new mailing</label>
            <input id="mailing-title" name="title" required maxLength={200} placeholder="This week's reading" />
          </div>
          <div style={{ alignSelf: "end", justifySelf: "start" }}>
            {/* button-secondary: the console's `.button` inherits the light ink onto its cyan fill. */}
            <button type="submit" className="button-secondary">Start writing</button>
          </div>
        </form>
        {mailings.length === 0 ? (
          <p className="small-note">No mailings to this series yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mailings.map((m) => (
                  <tr key={m.slug}>
                    <td>
                      <a href={mailingsHref(series.id, m.slug)}>{m.title}</a>
                    </td>
                    <td>
                      {m.sentAt
                        ? `Sent to ${m.sentCount} on ${new Date(m.sentAt).toLocaleDateString("en-CA")}`
                        : "Draft"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

/**
 * "Start writing": navigate to the new mailing's editor, which opens empty
 * and creates the row on its first save. Owner or guide, like the save route.
 */
async function createMailing(formData: FormData) {
  "use server";
  const seriesId = String(formData.get("seriesId") ?? "");
  await requireOrgEditor(mailingsHref(seriesId));
  const series = await findIfacSeries(seriesId);
  if (!series) notFound();
  const title = String(formData.get("title") ?? "").trim();
  const base = mailingSlug(title);
  const slug = isValidNewsletterSlug(base) ? base : `mailing-${Date.now()}`;
  redirect(`${mailingsHref(series.id, slug)}?title=${encodeURIComponent(title)}`);
}
