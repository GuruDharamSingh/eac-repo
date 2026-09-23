import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getProfileBySlug, listWriting } from "@elkdonis/services";
import { WritingShelf, StartPiece } from "@elkdonis/cms-ui/writing";
import { hasProfileSection, isMember } from "@/lib/members";
import { startPieceAction } from "@/lib/writing-actions";
import { getServerSession } from "@elkdonis/auth-server";
import { canEditProfile } from "@elkdonis/services";

/**
 * One member's writing, in full — the shelf behind the four pieces their
 * profile shows.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  return profile ? { title: `Writing — ${profile.displayName}` } : {};
}

export default async function MemberWritingPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile || !(await isMember(profile.userId))) notFound();
  // The section is the person's own decision; with it off, the shelf is not
  // theirs to show — even at a URL somebody kept.
  if (!(await hasProfileSection(profile.userId, "blog"))) notFound();

  // The owner reads their own drafts here; everyone else sees what is published.
  const session = await getServerSession();
  const viewerId = session.user ? (session.user.db_user_id ?? session.user.id) : null;
  const editable = Boolean(viewerId && (await canEditProfile(viewerId, profile.userId)));

  const items = await listWriting(profile.userId, {
    includeDrafts: editable,
    limit: 60,
  }).catch(() => []);

  return (
    <main className="hub">
      <div className="hub-band">
        <p className="hub-kicker">
          <Link href={`/artists/${slug}`}>← {profile.displayName}</Link>
        </p>
      </div>
      <section className="hub-band">
        <WritingShelf
          items={items.map((piece) => ({
            id: piece.id,
            slug: piece.slug ?? piece.id,
            title: piece.title,
            lede: piece.excerpt ?? null,
            publishedAt: piece.publishedAt ?? null,
            readingMinutes: piece.readingMinutes ?? null,
          }))}
          basePath={`/artists/${slug}/writing`}
          heading="Writing"
          kicker={profile.displayName}
          showDrafts={editable}
          emptyNote={
            editable
              ? "Nothing here yet. Start a piece — it stays a draft until you publish it."
              : "Nothing published yet."
          }
        >
          {editable && (
            <StartPiece
              onCreate={startPieceAction.bind(null, profile.userId)}
              basePath={`/artists/${slug}/writing`}
            />
          )}
        </WritingShelf>
      </section>
    </main>
  );
}
