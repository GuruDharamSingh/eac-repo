import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getOrgEmailIdentity,
  emailChromeFor,
  loadOrgTemplate,
  renderSample,
  templateMeta,
} from "@elkdonis/email";
import { TemplateWordsEditor } from "@elkdonis/cms-ui/email";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { siteConfig } from "@/config/site";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getSiteContent } from "@/lib/data";
import { requireOrgEditor } from "@/lib/auth";

export const metadata: Metadata = { title: "Email template" };
export const dynamic = "force-dynamic";

/**
 * One letter: what it currently says, and a box to say something of your own.
 *
 * The preview re-renders with whatever is stored, so what you read here is what
 * will actually send — not a mock-up of the default. It is an iframe with an
 * empty `sandbox`, which means no scripts: this is the one place in the product
 * where stored markup and a signed-in session meet.
 */
export default async function EmailTemplatePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const meta = templateMeta(key);
  // Unknown keys 404 rather than rendering an empty form: the only way to reach
  // one is a hand-edited URL, and a form that saves into a template nothing
  // sends is worse than a missing page.
  if (!meta || !meta.editable) notFound();

  const viewer = await requireOrgEditor(`/hub/email/${key}`);

  const [content, identity, stored] = await Promise.all([
    getSiteContent(),
    getOrgEmailIdentity(siteConfig.orgId),
    loadOrgTemplate(siteConfig.orgId, key),
  ]);

  const html = await renderSample(key, {
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
      <SiteHeader />

      <main className="hub hub-email-page">
        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName} · Email</p>
            <h1>{meta.title}</h1>
            <p className="hub-welcome-sub">
              {meta.trigger}. Goes to {meta.recipient.toLowerCase()}.
            </p>
          </div>
          <a className="hub-btn" href="/hub/email">
            &larr; All email
          </a>
        </div>

        <section className="hub-wide hub-email-letter">
          <TemplateWordsEditor
            templateKey={key}
            initialBodyHtml={stored?.bodyHtml}
            initialBodyText={stored?.bodyText}
            hint={meta.editHint}
            hasOwnLayout={Boolean(stored?.html)}
            editHref={`/hub/email/${key}/edit`}
            saveEndpoint={`/api/hub/email/${key}`}
            testEndpoint={`/api/hub/email/${key}/test`}
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
