import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PuckPage, pageData } from "@/lib/puck/render";
import { HOME_SLUG } from "@/lib/puck/store";
import { DEFAULT_HOME } from "@/lib/default-pages";
import { readingMetadata } from "@/lib/reading-privacy";

export const dynamic = "force-dynamic";

/** A reading placed on the home page would take it out of search engines too (lib/reading-privacy.ts). */
export async function generateMetadata(): Promise<Metadata> {
  return readingMetadata(await pageData(HOME_SLUG, DEFAULT_HOME));
}

/**
 * `/`: the studio document `home`, or DEFAULT_HOME until one is published.
 */
export default async function Home() {
  const data = await pageData(HOME_SLUG, DEFAULT_HOME);
  if (!data) notFound();
  return <PuckPage slug={HOME_SLUG} data={data} />;
}
