import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getOrgEmailIdentity,
  emailChromeFor,
  loadOrgTemplate,
  renderSample,
  resolveOrgTemplate,
  templateMeta,
} from "@elkdonis/email";
import { TemplateWordsEditor } from "@elkdonis/cms-ui/email";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { siteConfig } from "@/config/site";
import { SiteFooter } from "@/components/site-chrome";
import { HubCrumbBar } from "@/components/hub/HubCrumbBar";
import { getSiteContent } from "@/lib/data";
import { requireOrgEditor } from "@/lib/auth";
import { renderSeriesLetter, seriesScopeFrom } from "@/lib/series-letters-store";
import { seriesLettersHref, seriesScopeNote } from "@/lib/series-letters";

export const metadata: Metadata = { title: "Email template" };
export const dynamic = "force-dynamic";

/**
 * One letter: what it currently says, and a box to say something of your own.
 *
 * The preview re-renders with whatever is stored, so what you read here is what
 * will actually send — not a mock-up of the default. It is an iframe with an
 * empty `sandbox`, which means no scripts: this is the one place in the product
 * where stored markup and a signed-in session meet.
 *
 * `?series=<id>&purpose=<p>` edits one series' version of the letter
 * (`lib/series-letters.ts`): it opens on the series' row, or on the words it
 * inherits when it has none, and saves to the series' key. No layout editor
 * link on that path: series letters are edited as words.
 */
export default async function EmailTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ series?: string; purpose?: string }>;
}) {
  const { key } = await params;
  const query = await searchParams;
  const meta = templateMeta(key);
  // Unknown keys 404 rather than rendering an empty form: the only way to reach
  // one is a hand-edited URL, and a form that saves into a template nothing
  // sends is worse than a missing page.
  if (!meta || !meta.editable) notFound();

  const qs = new URLSearchParams();
  if (typeof query.series === "string") qs.set("series", query.series);
  if (typeof query.purpose === "string") qs.set("purpose", query.purpose);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  const viewer = await requireOrgEditor(`/hub/email/${key}${suffix}`);

  const target = await seriesScopeFrom(qs, key);
  if (target.kind === "error") notFound();
  const scope = target.kind === "series" ? target : null;

  const [content, identity, stored] = await Promise.all([
    getSiteContent(),
    getOrgEmailIdentity(siteConfig.orgId),
    scope
      ? loadOrgTemplate(siteConfig.orgId, scope.scope.scopedKey).then(
          (own) => own ?? resolveOrgTemplate(siteConfig.orgId, scope.scope.key, scope.scope.fallbackScopes)
        )
      : loadOrgTemplate(siteConfig.orgId, key),
  ]);

  const html = scope ? await renderSeriesLetter(scope.scope) : await renderSample(key, {
    orgName: identity.fromName,
    orgHeader: identity.fromIsOrgDomain,
    orgAccent: identity.accentColor,
    // And the face it is set in, so the preview is not quieter or louder
    // than the letter that leaves.
    bodyFont: identity.palette?.bodyFont,
    // The masthead image and the frame around the card, so the preview
    // wears the org's own banner rather than the collective's wordmark —
    // which is what the letter that leaves will do.
    chrome: emailChromeFor(identity),
    bodyText: stored?.bodyText,
    bodyHtml: stored?.bodyHtml,
    // The letter's OWN sentences, as this org has rewritten them. Without
    // this the preview renders the network's defaults and quietly disagrees
    // with what will actually send.
    copy: stored?.copy,
  });

  return (
    <div className="site-shell">
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
      <main className="hub hub-email-page">
        <HubCrumbBar
          items={[
            { label: "Hub", href: "/hub" },
            { label: "Email", href: "/manage/email?tab=letters" },
            ...(scope
              ? [{ label: scope.series.title, href: seriesLettersHref(scope.series.id) }]
              : []),
            { label: scope ? scope.scope.letter.title : meta.title },
          ]}
        />

        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName} · Email</p>
            <h1>{scope ? scope.scope.letter.title : meta.title}</h1>
            <p className="hub-welcome-sub">
              {scope ? scope.scope.letter.trigger : meta.trigger}. Goes to{" "}
              {(scope ? scope.scope.letter.recipient : meta.recipient).toLowerCase()}.
            </p>
            {scope && (
              <p className="hub-welcome-sub" data-series-scope={scope.scope.scopedKey}>
                {seriesScopeNote(scope.scope.letter.title, scope.series.title)}
              </p>
            )}
          </div>
          <a
            className="hub-btn"
            href={scope ? seriesLettersHref(scope.series.id) : "/manage/email?tab=letters"}
          >
            &larr; {scope ? "This series' letters" : "All email"}
          </a>
        </div>

        <section className="hub-wide hub-email-letter">
          <TemplateWordsEditor
            templateKey={key}
            initialBodyHtml={stored?.bodyHtml}
            initialBodyText={stored?.bodyText}
            hint={meta.editHint}
            hasOwnLayout={Boolean(stored?.html)}
            editHref={scope ? undefined : `/hub/email/${key}/edit`}
            saveEndpoint={`/api/hub/email/${key}${scope ? suffix : ""}`}
            testEndpoint={`/api/hub/email/${key}/test${scope ? suffix : ""}`}
          />

          <div className="hub-email-preview">
            <span className="eac-email-label">What sends today</span>
            <iframe title="Preview" srcDoc={html} sandbox="" />
          </div>
        </section>
      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}
