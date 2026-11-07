import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PuckPage, pageData, titleOf } from "@/lib/puck/render";
import { FIGURE_SLUG } from "@/lib/puck/store";
import { DEFAULT_FIGURE_PAGE } from "@/lib/default-pages";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await pageData(FIGURE_SLUG, DEFAULT_FIGURE_PAGE);
  return {
    title: titleOf(data) ?? "The Figure",
    description: "The enneagram as an instrument: nine points, four lenses, stress and growth lines, and each type's dossier read step by step.",
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
  return <PuckPage slug={FIGURE_SLUG} data={data} />;
}
