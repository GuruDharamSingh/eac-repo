import { notFound } from "next/navigation";
import { getServerSession } from "@elkdonis/auth-server";
import {
  canEditProfile,
  getWritingPost,
  listWriting,
} from "@elkdonis/services";
import { ArticleView } from "@elkdonis/cms-ui/article";
import { WritingShelf, WritingDesk, StartPiece } from "@elkdonis/cms-ui/writing";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { blogOrgScopeFor } from "@/lib/cms/blog-actions";
import { getDirectoryProfile } from "@/lib/directory";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { defaultSiteContent } from "@/lib/default-content";
import { siteConfig } from "@/config/site";
import {
  deletePieceAction,
  savePieceAction,
  startPieceAction,
} from "@/lib/writing-actions";

/**
 * A member's own writing: /<kind>/<slug>/writing and /<kind>/<slug>/writing/<piece>.
 *
 * Shared by the artist and dealer routes so the two stay identical, the same
 * way GalleryPageView is — only the back link and the kind check differ.
 *
 * Everything here is scoped to the PROFILE's user: the shelf lists that
 * person's pieces and a piece slug is resolved under them, so an address under
 * one artist can never serve another's writing.
 *
 * Drafts exist only for their author (and admins). For everyone else an
 * unpublished piece is not a locked page, it is not a page — same rule as a
 * hidden gallery.
 */

async function context(kind: "artist" | "dealer", slug: string) {
  const profile = await getDirectoryProfile(slug);
  if (!profile || profile.kind !== kind || !profile.userId) notFound();

  const session = await getServerSession();
  const viewerId = session.user ? (session.user.db_user_id ?? session.user.id) : null;
  const editable = Boolean(viewerId && (await canEditProfile(viewerId, profile.userId)));

  const base = kind === "artist" ? "artists" : "dealers";
  return {
    profile,
    userId: profile.userId,
    editable,
    profileHref: `/${base}/${profile.slug}`,
    writingHref: `/${base}/${profile.slug}/writing`,
  };
}

/** The shelf — everything this person has written. */
export async function WritingShelfPage({
  kind,
  slug,
}: {
  kind: "artist" | "dealer";
  slug: string;
}) {
  const ctx = await context(kind, slug);
  // The AUTHOR's choice, not this site's: a member who asked for everything
  // they write across the network gets an unscoped read (`orgId` undefined).
  // See blogOrgScopeFor — without this the scope control would be a setting
  // that changed nothing.
  const items = await listWriting(ctx.userId, {
    orgId: await blogOrgScopeFor(ctx.userId),
    includeDrafts: ctx.editable,
  });

  // A shelf with nothing on it is a page a visitor should not have been sent
  // to; for the owner it is where they start.
  if (items.length === 0 && !ctx.editable) notFound();

  return (
    <div className="site-shell">
      <ThemeStyle orgId={siteConfig.orgId} userId={ctx.userId} />
      <SiteHeader />
      <main>
        <div className="profile-intro">
          <a className="profile-back" href={ctx.profileHref}>
            ← {ctx.profile.name}
          </a>
        </div>

        <WritingShelf
          items={items}
          basePath={ctx.writingHref}
          heading="Writing"
          kicker={ctx.profile.name}
          showDrafts={ctx.editable}
          emptyNote={
            ctx.editable
              ? "Nothing here yet. Start below — it stays a draft until you publish it."
              : "Nothing published yet."
          }
        >
          {ctx.editable && (
            <StartPiece
              onCreate={startPieceAction.bind(null, ctx.userId)}
              basePath={ctx.writingHref}
            />
          )}
        </WritingShelf>
      </main>
      <SiteFooter content={defaultSiteContent.footer} />
    </div>
  );
}

/** One piece — read, or written when its author asks for `?edit=1`. */
export async function WritingPieceView({
  kind,
  slug,
  pieceSlug,
  startEditing,
}: {
  kind: "artist" | "dealer";
  slug: string;
  pieceSlug: string;
  startEditing: boolean;
}) {
  const ctx = await context(kind, slug);
  const post = await getWritingPost(ctx.userId, pieceSlug, {
    includeDrafts: ctx.editable,
  });
  if (!post) notFound();

  const editing = startEditing && ctx.editable;

  return (
    <div className="site-shell">
      {/* The person's own palette, as on their profile — their writing is part
          of their page, not a separate publication. */}
      <ThemeStyle orgId={siteConfig.orgId} userId={ctx.userId} />
      <SiteHeader />
      <main>
        <div className="profile-intro">
          <a className="profile-back" href={ctx.writingHref}>
            ← {ctx.profile.name}&rsquo;s writing
          </a>
        </div>

        {editing ? (
          <WritingDesk
          authorName={ctx.profile.name}
            post={post}
            basePath={ctx.writingHref}
            onSave={savePieceAction.bind(null, post.id)}
            onDelete={deletePieceAction.bind(null, post.id)}
            upload={{
              endpoint: "/api/upload",
              // The file lands in the author's own folder, not IFAC's tree —
              // see the upload route. "file" stores it without also appending
              // it to their artwork grid.
              fields: { memberSlug: ctx.profile.slug, target: "file" },
            }}
          />
        ) : (
          <ArticleView
            title={post.title}
            lede={post.lede}
            bodyHtml={post.bodyHtml}
            authorName={ctx.profile.name}
            publishedAt={post.publishedAt ?? post.updatedAt}
            kindLabel={post.status === "draft" ? "Draft" : "Writing"}
            org={{ name: ctx.profile.name, href: ctx.profileHref }}
            coverImageUrl={post.coverImageUrl}
            readingMinutes={post.readingMinutes}
            provenance={{
              publishedOn: [{ name: siteConfig.shortName, href: "/" }],
              record: `${ctx.writingHref}/${post.slug}`,
            }}
          >
            <div className="writing-piece-actions">
              {post.status === "draft" && (
                <p className="writing-draft-note">
                  This is a draft. Only you and IFAC&rsquo;s admins can see it.
                </p>
              )}
              {ctx.editable && (
                <a
                  className="button-secondary"
                  href={`${ctx.writingHref}/${post.slug}?edit=1`}
                >
                  Edit this piece
                </a>
              )}
            </div>
          </ArticleView>
        )}
      </main>
      <SiteFooter content={defaultSiteContent.footer} />
    </div>
  );
}
