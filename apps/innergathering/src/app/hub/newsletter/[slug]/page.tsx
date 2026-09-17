import { notFound } from "next/navigation";
import Link from "next/link";
import { isValidNewsletterSlug, publicBaseUrl } from "@elkdonis/newsletter";
import { loadNewsletter, listRecipients, listThreadsForCards } from "@elkdonis/newsletter/server";
import { headers } from "next/headers";
import { NewsletterEditor } from "@elkdonis/newsletter/editor";
import "@elkdonis/newsletter/editor.css";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

/**
 * Write one letter.
 *
 * Gated here so someone without the role never loads the editor, and again in
 * the API routes it posts to — a client component is not an authorisation
 * boundary.
 *
 * `theme="dark"` so the block library's shapes match the rest of the suite;
 * a newsletter composed in the parchment palette would arrive looking like a
 * different organisation than the RSVP confirmation sent the same week.
 */
export default async function NewsletterEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const { slug } = await params;
  if (!isValidNewsletterSlug(slug)) notFound();

  const viewer = await requireOrgEditor(`/hub/newsletter/${slug}`);

  // The URLs on a card have to point at the host this org actually answers on,
  // which is a request fact rather than a configured one — the same reasoning
  // the send route uses to build the unsubscribe link.
  const h = await headers();
  const baseUrl = publicBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL,
    h.get("x-forwarded-proto"),
    h.get("x-forwarded-host") ?? h.get("host")
  );

  const [letter, recipients, threads, { title: seedTitle }] = await Promise.all([
    loadNewsletter(siteConfig.orgId, slug),
    listRecipients(siteConfig.orgId),
    // What an author may point a thread card at. Published and public only,
    // and this org's own — `threads` is one shared namespace network-wide.
    listThreadsForCards(siteConfig.orgId, baseUrl).catch(() => []),
    searchParams,
  ]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-border px-4 py-2">
        <Link href="/hub/newsletter" className="text-sm text-muted-foreground underline underline-offset-4">
          ← All letters
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <NewsletterEditor
          theme="dark"
          slug={slug}
          title={letter?.title ?? seedTitle ?? slug}
          project={letter?.project ?? null}
          saveEndpoint={`/api/newsletter/${slug}`}
          sendEndpoint={`/api/newsletter/${slug}/send`}
          recipientCount={recipients.length}
          testAddress={viewer.email}
          threads={threads}
        />
      </div>
    </div>
  );
}
