import { notFound } from "next/navigation";
import { isValidNewsletterSlug } from "@elkdonis/newsletter";
import { loadNewsletter, listRecipients } from "@elkdonis/newsletter/server";
import { NewsletterEditor } from "@elkdonis/newsletter/editor";
import "@elkdonis/newsletter/editor.css";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Write one letter.
 *
 * Gated here so someone without the role never loads the editor, and again in
 * the API routes it posts to — a client component is not an authorisation
 * boundary.
 */
export const dynamic = "force-dynamic";

export default async function NewsletterEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const { slug } = await params;
  if (!isValidNewsletterSlug(slug)) notFound();

  const viewer = await requireOrgEditor(`/manage/newsletter/${slug}`);
  const [letter, recipients, { title: seedTitle }] = await Promise.all([
    loadNewsletter(siteConfig.orgId, slug),
    listRecipients(siteConfig.orgId),
    searchParams,
  ]);

  return (
    <NewsletterEditor
      slug={slug}
      title={letter?.title ?? seedTitle ?? slug}
      project={letter?.project ?? null}
      saveEndpoint={`/api/newsletter/${slug}`}
      sendEndpoint={`/api/newsletter/${slug}/send`}
      recipientCount={recipients.length}
      testAddress={viewer.email}
    />
  );
}
