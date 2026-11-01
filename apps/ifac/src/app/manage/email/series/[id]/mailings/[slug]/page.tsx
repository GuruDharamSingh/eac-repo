import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOrgEmailIdentity } from "@elkdonis/email";
import { isValidNewsletterSlug, paletteFor } from "@elkdonis/newsletter";
import { listRecipients, loadNewsletter } from "@elkdonis/newsletter/server";
import { NewsletterEditor } from "@elkdonis/newsletter/editor";
import "@elkdonis/newsletter/editor.css";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";
import { findIfacSeries } from "@/lib/series-letters-store";
import { mailingApi, mailingsHref, seriesAudience } from "@/lib/series-letters-mailings";

export const metadata: Metadata = { title: "Mailing to a series — IFAC" };
export const dynamic = "force-dynamic";

/**
 * Write one mailing to a series' subscribers: the newsletter editor with the
 * audience fixed to this series (lib/series-letters-mailings.ts). A letter
 * that does not exist yet opens empty and is created on its first save.
 *
 * Owner or guide (`requireOrgEditor`), the same rule the save and send routes
 * apply. No thread-card picker: IFAC threads are not served at the
 * `/<section>/<slug>` address those cards link to.
 */
export default async function SeriesMailingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; slug: string }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const { id, slug } = await params;
  if (!isValidNewsletterSlug(slug)) notFound();
  const viewer = await requireOrgEditor(mailingsHref(id, slug));
  const series = await findIfacSeries(id);
  if (!series) notFound();

  const audience = seriesAudience(series.id);
  const [letter, recipients, identity, { title: seedTitle }] = await Promise.all([
    loadNewsletter(siteConfig.orgId, slug, audience),
    listRecipients(siteConfig.orgId, audience),
    getOrgEmailIdentity(siteConfig.orgId),
    searchParams,
  ]);
  const accent = identity.palette?.accent ?? identity.accentColor;

  return (
    <section className="manage-email manage-series-mailing" data-series-mailing={`${series.id}:${slug}`}>
      <p className="kicker">Mailing to a series</p>
      <h2>{series.title}</h2>
      <p className="body-copy">
        Goes to the {recipients.length} {recipients.length === 1 ? "person" : "people"} subscribed to this
        series, not to people who only said they are coming to one week, and not to anyone who unsubscribed
        from IFAC&rsquo;s mail. Each copy ends with a link to unsubscribe from this series.
      </p>
      <p className="body-copy">
        <a href={mailingsHref(series.id)}>&larr; All mailings to this series</a>
      </p>
      <div className="manage-series-mailing__editor">
        <NewsletterEditor
          theme="light"
          palette={paletteFor({ accent })}
          slug={slug}
          title={letter?.title ?? seedTitle ?? slug}
          project={letter?.project ?? null}
          saveEndpoint={mailingApi(series.id, slug)}
          sendEndpoint={`${mailingApi(series.id, slug)}/send`}
          recipientCount={recipients.length}
          audienceLabel={`${recipients.length === 1 ? "subscriber" : "subscribers"} of ${series.title}`}
          testAddress={viewer.email}
        />
      </div>
    </section>
  );
}
