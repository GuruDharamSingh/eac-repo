import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWritingPost, listOrgWriting } from "@elkdonis/services";
import { isValidSlug } from "@elkdonis/page-builder";
import { Article } from "@/blocks/writing-blocks";
import { loadPiece } from "@/lib/puck/data-writing";
import { renderPuckPage } from "@/lib/puck/render";
import { siteConfig } from "@/config/site";

/**
 * One piece written in the writing room (@elkdonis/studio), shown on this site.
 *
 * Not `/[feed]/[slug]`: a Studio piece is `kind = 'writing'`, homed on its
 * author's own space and listed here through `thread_orgs` ("Show on"). It has
 * no section, so the section-scoped thread route would never find it. The
 * piece is found among the ones listed on this org before it is read, so this
 * path cannot serve a piece that is not shown here.
 *
 * Drawn from the `journal-piece` template document once one is published
 * (lib/puck/templates.ts), otherwise as the bare article. The piece's own
 * layout, series, byline and SEO come from the writing room either way.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ piece: string }> };

async function find(slug: string) {
  if (!isValidSlug(slug)) return null;
  const listed = await listOrgWriting(siteConfig.orgId, { limit: 50 }).catch(() => []);
  const hit = listed.find((p) => p.slug === slug);
  if (!hit) return null;
  const post = await getWritingPost(hit.author.id, hit.slug);
  return post ? { hit, post } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { piece } = await params;
  const found = await find(piece);
  if (!found) return {};
  const { post } = found;
  const title = post.seo?.title || post.title;
  const description = post.seo?.description || post.lede || undefined;
  const image = post.seo?.imageUrl || post.coverImageUrl || undefined;
  return {
    title,
    description,
    robots: post.seo?.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description, type: "article", images: image ? [image] : undefined },
  };
}

export default async function JournalPiecePage({ params }: Props) {
  const { piece } = await params;
  const found = await find(piece);
  if (!found) notFound();

  const designed = await renderPuckPage("journal-piece", { template: true, metadata: { piece } });
  if (designed) return designed;

  const { post } = (await loadPiece({}, { piece })) ;
  if (!post) notFound();
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Article post={post} reading="journal" showBack showCover />
    </div>
  );
}
