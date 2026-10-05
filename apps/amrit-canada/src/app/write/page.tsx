import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile, getWritingPostById, listWriting } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { WritingRoom } from "@/components/writing-room/writing-room";

export const metadata: Metadata = { title: "Writing room" };

type Props = { searchParams: Promise<{ piece?: string }> };

/**
 * The writing room: a dark page with a title and a body. `?piece=<id>` opens
 * one of the viewer's own pieces; without it the page is blank and the piece
 * is created on the first save.
 */
export default async function WritePage({ searchParams }: Props) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent("/write")}`);
  if (!viewer.isAffiliate) redirect("/");

  const { piece: pieceId } = await searchParams;

  const [pieces, profile, opened] = await Promise.all([
    listWriting(viewer.userId, { orgId: siteConfig.orgId, includeDrafts: true, limit: 100 }),
    getProfile(viewer.userId).catch(() => null),
    pieceId ? getWritingPostById(pieceId) : null,
  ]);

  const own =
    opened && opened.authorId === viewer.userId && opened.orgId === siteConfig.orgId
      ? opened
      : null;

  return (
    <WritingRoom
      key={own?.id ?? "new"}
      initial={
        own
          ? {
              id: own.id,
              slug: own.slug,
              title: own.title,
              bodyHtml: own.bodyHtml,
              status: own.status,
              publishedAt: own.publishedAt,
              updatedAt: own.updatedAt,
            }
          : null
      }
      pieces={pieces.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        updatedAt: p.updatedAt,
      }))}
      authorSlug={profile?.slug ?? null}
    />
  );
}
