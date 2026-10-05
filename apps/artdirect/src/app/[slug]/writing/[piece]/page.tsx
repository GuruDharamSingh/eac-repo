import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canEditProfile, getProfileBySlug, getWritingPost } from "@elkdonis/services";
import { ArticleView } from "@elkdonis/cms-ui/article";
import { WritingDesk } from "@elkdonis/cms-ui/writing";
import "@elkdonis/cms-ui/editor.css";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getCurrentUser } from "@/lib/session";
import {
  deletePieceAction,
  loadPieceListingAction,
  savePieceAction,
  setPieceListingAction,
} from "@/lib/writing-actions";

/**
 * One piece, in the reading layer. The piece is resolved under the person
 * (author + slug), so an address under one person never serves another's
 * writing.
 *
 * A draft is readable only by its author and global admins; for everyone else
 * it is not a page. Published pieces are public and open from their links
 * even when the person is unlisted from the directory (brief decision 3:
 * listing is not audience). Its author opens the writing desk here with
 * `?edit=1` (2026-09-27; actions in lib/writing-actions.ts).
 */
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string; piece: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, piece } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) return {};
  // Published only: a draft's title is not handed to crawlers.
  const post = await getWritingPost(profile.userId, piece);
  if (!post) return {};
  return {
    title: `${post.title} — ${profile.displayName}`,
    description: post.lede ?? undefined,
    openGraph: {
      title: post.title,
      description: post.lede ?? undefined,
      type: "article",
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function WritingPiecePage({ params, searchParams }: Props) {
  const { slug, piece } = await params;
  const { edit } = await searchParams;
  const profile = await getProfileBySlug(slug);
  if (!profile) notFound();

  const user = await getCurrentUser();
  const editable = Boolean(user && (await canEditProfile(user.id, profile.userId)));

  const post = await getWritingPost(profile.userId, piece, { includeDrafts: editable });
  if (!post) notFound();

  const key = profile.slug ?? profile.userId;
  const basePath = `/${key}/writing`;

  if (editable && edit === "1") {
    const listing = await loadPieceListingAction(post.id);
    return (
      <>
        <ThemeStyle userId={profile.userId} precedence="user" />
        <main className="oad-reading oad-desk">
          <p className="oad-reading-back">
            <a href={basePath}>← {profile.displayName}&rsquo;s writing</a>
          </p>
          <WritingDesk
            authorName={profile.displayName}
            post={post}
            basePath={basePath}
            onSave={savePieceAction.bind(null, post.id)}
            onDelete={deletePieceAction.bind(null, post.id)}
            listing={listing ? { ...listing, onChange: setPieceListingAction.bind(null, post.id) } : undefined}
            upload={{ endpoint: `/api/upload?target=page&slug=${encodeURIComponent(key)}` }}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <ThemeStyle userId={profile.userId} precedence="user" />
      <main className="oad-reading">
        <p className="oad-reading-back">
          <a href={`/${key}/writing`}>← {profile.displayName}&rsquo;s writing</a>
        </p>
        <ArticleView
          title={post.title}
          lede={post.lede}
          bodyHtml={post.bodyHtml}
          threadId={post.id}
          authorName={profile.displayName}
          publishedAt={post.publishedAt}
          coverImageUrl={post.coverImageUrl}
          // A reel published from the Studio (reels.ts publishReel).
          video={post.video ? { src: post.video.src, poster: post.video.poster } : null}
          readingMinutes={post.readingMinutes}
          kindLabel={post.status === "draft" ? "Draft" : null}
        >
          {editable ? (
            <p className="oad-reading-back">
              <a href={`${basePath}/${post.slug}?edit=1`}>Edit this piece →</a>
            </p>
          ) : null}
        </ArticleView>
      </main>
    </>
  );
}
