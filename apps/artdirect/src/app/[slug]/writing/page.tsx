import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canEditProfile, getProfileBySlug, listWriting } from "@elkdonis/services";
import { StartPiece, WritingShelf } from "@elkdonis/cms-ui/writing";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { getCurrentUser } from "@/lib/session";
import { isOadSteward } from "@/lib/oad";
import { startPieceAction } from "@/lib/writing-actions";

/**
 * One person's writing, in full: the shelf behind the pieces their page
 * shows. ArtDirect is the home of personal writing (`oad`), so every piece
 * the person wrote is listed here, whichever site it was started from; there
 * is no org scope and no section check.
 *
 * Drafts show to the person and to global admins (canEditProfile). An
 * unlisted person (users.directory_listed = false) has no shelf for
 * visitors, the same as their page; single pieces stay readable from their
 * links (see ./[piece]/page.tsx).
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile || !profile.directoryListed) return {};
  return { title: `Writing — ${profile.displayName} — ArtDirect` };
}

export default async function WritingShelfPage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  if (!profile) notFound();

  const user = await getCurrentUser();
  const viewerId = user?.id ?? null;
  const editable = Boolean(viewerId && (await canEditProfile(viewerId, profile.userId)));
  if (!profile.directoryListed && !editable && !(viewerId && (await isOadSteward(viewerId)))) notFound();

  const items = await listWriting(profile.userId, { includeDrafts: editable, limit: 100 }).catch(() => []);
  if (items.length === 0 && !editable) notFound();

  const key = profile.slug ?? profile.userId;
  const basePath = `/${key}/writing`;

  return (
    <>
      <ThemeStyle userId={profile.userId} precedence="user" />
      <main className="oad-reading">
        <p className="oad-reading-back">
          <a href={`/${key}`}>← {profile.displayName}</a>
        </p>
        <WritingShelf
          items={items}
          basePath={basePath}
          heading="Writing"
          kicker={profile.displayName}
          showDrafts={editable}
          emptyNote="Nothing here yet."
        >
          {/* The owner's way into the writing desk: a title starts a piece and
              opens it at <piece>?edit=1. Only for the page's own person, since
              startPieceAction always writes as the signed-in user. */}
          {viewerId === profile.userId && <StartPiece onCreate={startPieceAction} basePath={basePath} />}
        </WritingShelf>
      </main>
    </>
  );
}
