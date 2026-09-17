import { notFound } from "next/navigation";
import type { Metadata } from "next";
// The /rsc entry explicitly, not "@puckeditor/core". Both export a component
// called Render and TypeScript types them identically, but they are different
// implementations: the bare specifier only resolves to the server one because
// Next honours the package's "react-server" export condition. Nothing in this
// file said so, and if that resolution ever changed we would ship the whole
// editor bundle to every visitor and crash on a hook in a server component.
import { Render, resolveAllData } from "@puckeditor/core/rsc";
import type { Data } from "@puckeditor/core";
import { siteConfig } from "@/config/site";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { isValidSlug } from "@elkdonis/page-builder";
import { loadPage } from "@/lib/puck/store";

/**
 * A published page.
 *
 * `<Render>` walks the saved JSON and draws the same components the editor
 * drew, from the same catalogue — so what was arranged is what ships.
 *
 * It applies no defaults and runs no resolvers, though, which is why
 * `resolveAllData` runs first: a feed block stores only its display settings,
 * and its rows are fetched here, at request time. Without that step a feed
 * would publish whatever happened to be in the document when it was saved.
 */
export const dynamic = "force-dynamic";

/** Every block the catalogue knows, so a stale saved page can be reported. */
const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug, KNOWN_TYPES);
  // The title an author set in the editor's page settings, falling back to the
  // slug. Reading it here is the whole reason the root config has a field.
  const root = (page?.data as Data | undefined)?.root;
  const title = root && "props" in root ? (root.props as { title?: string })?.title : undefined;
  return { title: title?.trim() || slug.replace(/-/g, " ") };
}

export default async function PublishedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const page = await loadPage(slug, KNOWN_TYPES);
  // Covers both "never published" and "stored but not renderable" — loadPage
  // returns null for either. A blank page at a real URL reads as a broken
  // site; a 404 reads as an unfinished one, which is the truth.
  if (!page) notFound();

  const resolved = await resolveAllData(page.data as Data, serverPuckConfig, {
    orgId: siteConfig.orgId,
    slug,
  });

  return <Render config={serverPuckConfig} data={resolved as Data} />;
}
