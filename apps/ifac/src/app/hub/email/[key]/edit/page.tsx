import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadOrgTemplate,
  templateMeta,
  TEMPLATE_META,
  getOrgEmailIdentity,
  emailChromeFor,
  renderTemplateBody,
  renderTemplateEnvelope,
  mergeFieldsFor,
} from "@elkdonis/email";
import { NewsletterEditor } from "@elkdonis/newsletter/editor";
import "@elkdonis/newsletter/editor.css";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

export const metadata: Metadata = { title: "Lay out the email" };
export const dynamic = "force-dynamic";

/**
 * The advanced path: lay the letter out yourself.
 *
 * The same GrapesJS editor the newsletter uses, in `mode="template"` — which
 * removes the "send to everyone" button, because this is the body of an
 * automatic email and mailing an RSVP confirmation to the whole contact list is
 * a mistake you only get to make once.
 *
 * What you compose replaces the BODY. The header, the footer and whatever the
 * footer carries stay the network's, so no layout can lose an unsubscribe link.
 *
 * Deliberately WITHOUT the site chrome the sibling pages wear: this is a
 * full-height canvas with its own rails, and a header above it would cost the
 * editor the viewport it needs. One link back, and that is all.
 *
 * ── What it opens on ────────────────────────────────────────────────────────
 *
 * The letter you clicked, not a blank page. The seed carries `{field}` tokens
 * rather than sample values — "{guestName}" where the preview said "Ada
 * Whitfield" — because this HTML is inserted for every recipient, and seeding
 * with the preview's own text would mail one person's name to everybody.
 */
export default async function EmailTemplateEditPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const meta = templateMeta(key);
  if (!meta || !meta.editable) notFound();

  const viewer = await requireOrgEditor(`/hub/email/${key}/edit`);
  const [stored, identity] = await Promise.all([
    loadOrgTemplate(siteConfig.orgId, key),
    getOrgEmailIdentity(siteConfig.orgId),
  ]);

  const orgName = identity.fromName;
  // The chrome the real letter wears. The ENVELOPE below is drawn around the
  // canvas so an author composes inside the letter rather than on a blank
  // page — which only holds if the envelope is this org's, banner and frame
  // and all, rather than the collective's default.
  const seed = {
    orgName,
    // The same four values the send path resolves. Without `orgHeader` the
    // envelope drew the collective's kicker band over an org that leads its
    // own letters, so the editor showed a header the recipient never gets.
    orgHeader: identity.fromIsOrgDomain,
    orgAccent: identity.palette?.accent ?? identity.accentColor,
    bodyFont: identity.palette?.bodyFont,
    chrome: emailChromeFor(identity),
  };

  // The letter itself, and every other letter as a droppable block. Rendered
  // here because they are React templates — the editor is a client component
  // and cannot render them, so it receives them as markup.
  const [seedHtml, envelope, letters] = await Promise.all([
    renderTemplateBody(key, seed).catch(() => ""),
    // The masthead and footer the real letter carries, drawn around the canvas
    // so the author composes inside the letter instead of on a blank page.
    renderTemplateEnvelope(key, seed).catch(() => null),
    Promise.all(
      TEMPLATE_META.filter((m) => m.editable).map(async (m) => ({
        id: m.key,
        label: m.title,
        hint: m.trigger,
        html: await renderTemplateBody(m.key, seed).catch(() => ""),
      }))
    ),
  ]);

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-border px-4 py-2">
        <Link
          // Back to where "Open in Editor" was pressed, which is the Letters
          // tab of the manage console — not the per-letter page, which is a
          // third place to edit the same letter and not where anyone came
          // from.
          href="/manage/email?tab=letters"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          &larr; {meta.title}
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <NewsletterEditor
          mode="template"
          theme="dark"
          subjectLabel="Template"
          slug={key}
          title={meta.title}
          project={stored?.project ?? null}
          seedHtml={seedHtml}
          envelope={envelope ?? undefined}
          letterBlocks={letters.filter((l) => l.html)}
          fields={mergeFieldsFor(key).map((f) => ({ name: f.name, label: f.label }))}
          saveEndpoint={`/api/hub/email/${key}`}
          sendEndpoint={`/api/hub/email/${key}/test`}
          recipientCount={0}
          testAddress={viewer.email}
        />
      </div>
    </div>
  );
}
