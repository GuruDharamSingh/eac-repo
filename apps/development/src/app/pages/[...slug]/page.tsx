import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPageWithVersion, isValidPagePath } from "@elkdonis/page-builder/server";
import { requireNetworkAdmin } from "@/lib/gate";
import { DEV_ORG } from "@/lib/sites-pages-core";
import type { PageDoc } from "@/lib/sites-door";
import { PagesView } from "@/components/sites/PagesView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "A page of the development site" };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** The development organisation's PUBLISHED page (never a draft), for network admins only, with the live editor on. */
export default async function DevPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const p = await params;
  const slug = p.slug.map(decode).join("/");
  await requireNetworkAdmin(`/pages/${p.slug.join("/")}`);
  if (!isValidPagePath(slug)) notFound();
  const page = await loadPageWithVersion(DEV_ORG, slug);
  if (!page) notFound();
  const doc = page.data as PageDoc;
  const title = typeof doc.root?.props?.title === "string" && doc.root.props.title.trim() ? doc.root.props.title : slug;
  return (
    <div className="dev-page">
      <PagesView slug={slug} title={title} doc={doc} version={page.updatedAt} />
    </div>
  );
}
