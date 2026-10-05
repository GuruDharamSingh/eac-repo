import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProfileBySlug, listWriting } from "@elkdonis/services";
import { WritingShelf } from "@elkdonis/cms-ui/writing";
import { siteConfig } from "@/config/site";

/** One person's published writing on this site, from the writing room. */
type Props = { params: Promise<{ author: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { author } = await params;
  const profile = await getProfileBySlug(author);
  return profile ? { title: `Writing — ${profile.displayName}` } : {};
}

export default async function WritingShelfPage({ params }: Props) {
  const { author } = await params;
  const profile = await getProfileBySlug(author);
  if (!profile) notFound();

  const items = await listWriting(profile.userId, { orgId: siteConfig.orgId, limit: 60 });
  if (items.length === 0) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <WritingShelf
        items={items.map((piece) => ({
          id: piece.id,
          slug: piece.slug,
          title: piece.title,
          lede: piece.lede,
          coverImageUrl: piece.coverImageUrl,
          publishedAt: piece.publishedAt,
          readingMinutes: piece.readingMinutes,
        }))}
        basePath={`/writing/${author}`}
        heading="Writing"
        kicker={profile.displayName}
      />
    </div>
  );
}
