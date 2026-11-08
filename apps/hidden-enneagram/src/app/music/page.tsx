import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PuckPage, pageData, titleOf } from "@/lib/puck/render";
import { MUSIC_SLUG } from "@/lib/puck/store";
import { DEFAULT_MUSIC_PAGE } from "@/lib/default-pages";
import { readingMetadata } from "@/lib/reading-privacy";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await pageData(MUSIC_SLUG, DEFAULT_MUSIC_PAGE);
  return {
    title: titleOf(data) ?? "Music",
    description: "The web of music beside the enneagram: Ouspensky's octave on the nine points, the twelve notes round them, and a Tonnetz to play.",
    ...readingMetadata(data),
  };
}

/**
 * /music: the studio document `music`, or DEFAULT_MUSIC_PAGE until one is
 * published (edit at /studio/music). The web of music on its own, then the
 * figure with the twelve-note ring laid on it.
 */
export default async function MusicPage() {
  const data = await pageData(MUSIC_SLUG, DEFAULT_MUSIC_PAGE);
  if (!data) notFound();
  return <PuckPage slug={MUSIC_SLUG} data={data} />;
}
