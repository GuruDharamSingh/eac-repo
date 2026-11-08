import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PuckPage, pageData, titleOf } from "@/lib/puck/render";
import { FIGURE_SLUG } from "@/lib/puck/store";
import { DEFAULT_FIGURE_PAGE } from "@/lib/default-pages";
import { readingMetadata } from "@/lib/reading-privacy";
import { TypeLinks } from "@/components/exposition/type-links";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await pageData(FIGURE_SLUG, DEFAULT_FIGURE_PAGE);
  return {
    title: titleOf(data) ?? "The Enneagram",
    description: "The enneagram in Ario's words: the centers, the core fixation, the triads and the nine types, beside the figure.",
    ...readingMetadata(data),
  };
}

/**
 * /enneagram, "The Figure": the studio document `enneagram`, or
 * DEFAULT_FIGURE_PAGE until one is published. `#type-4` opens the dossier on
 * type 4 (the home page's summary links here that way).
 */
export default async function FigurePage() {
  const data = await pageData(FIGURE_SLUG, DEFAULT_FIGURE_PAGE);
  if (!data) notFound();
  return (
    <>
      <PuckPage slug={FIGURE_SLUG} data={data} />
      {/* Round 3: a tap on a type (figure or text) opens its Surface popup. */}
      <TypeLinks />
    </>
  );
}
