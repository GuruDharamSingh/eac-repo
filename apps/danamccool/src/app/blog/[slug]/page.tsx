import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getWritingPost } from "@elkdonis/services";
import { ArticleView } from "@elkdonis/cms-ui/article";
import { WritingDesk } from "@elkdonis/cms-ui/writing";
import { blogContext } from "@/lib/writing";
import { deletePieceAction, savePieceAction } from "@/lib/writing-actions";
import { siteConfig } from "@/config/site";

// One piece at /blog/<slug> — read, or written in place when its author adds
// ?edit=1. Drafts exist only for her: for anyone else an unpublished piece is
// not a locked page, it is not a page.

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { authorId } = await blogContext();
  const post = authorId ? await getWritingPost(authorId, slug) : null;
  if (!post) return {};
  return {
    title: post.title,
    description: post.lede ?? undefined,
    openGraph: {
      title: post.title,
      description: post.lede ?? undefined,
      type: "article",
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPiecePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { edit } = await searchParams;
  const { authorId, canWrite } = await blogContext();
  if (!authorId) notFound();
  const post = await getWritingPost(authorId, slug, { includeDrafts: canWrite });
  if (!post) notFound();

  return (
    <div className="dm-blog">
      <p className="dm-blog-back">
        <a href="/blog">← Writing</a>
      </p>
      {edit === "1" && canWrite ? (
        <WritingDesk
          authorName={siteConfig.orgName}
          post={post}
          basePath="/blog"
          onSave={savePieceAction.bind(null, post.id)}
          onDelete={deletePieceAction.bind(null, post.id)}
          upload={{ endpoint: "/api/media/upload", fields: {} }}
        />
      ) : (
        <ArticleView
          title={post.title}
          lede={post.lede}
          bodyHtml={post.bodyHtml}
          authorName={siteConfig.orgName}
          publishedAt={post.publishedAt ?? post.updatedAt}
          kindLabel={post.status === "draft" ? "Draft" : "Writing"}
          org={{ name: siteConfig.orgName, href: "/" }}
          coverImageUrl={post.coverImageUrl}
          readingMinutes={post.readingMinutes}
          provenance={{ publishedOn: [{ name: siteConfig.shortName, href: "/" }], record: `/blog/${post.slug}` }}
        >
          {canWrite ? (
            <p className="dm-blog-edit">
              {post.status === "draft" ? <span>Draft — only you can see it. </span> : null}
              <a href={`/blog/${post.slug}?edit=1`}>Edit this piece</a>
            </p>
          ) : null}
        </ArticleView>
      )}
    </div>
  );
}
