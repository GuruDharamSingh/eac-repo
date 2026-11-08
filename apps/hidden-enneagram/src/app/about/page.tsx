import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PuckPage, pageData, titleOf } from "@/lib/puck/render";
import { ABOUT_SLUG } from "@/lib/puck/store";
import { DEFAULT_ABOUT_PAGE } from "@/lib/default-pages";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await pageData(ABOUT_SLUG, DEFAULT_ABOUT_PAGE);
  return { title: titleOf(data) ?? "About", description: "Ario: musician, educator and workshop facilitator; enneagram readings and counselling." };
}

/**
 * /about (round 3): a studio page, `puck:about` or DEFAULT_ABOUT_PAGE, in
 * ifac's About shape (a heading, a statement, the person's portrait card),
 * every word editable. The portrait is the profile's photo (he-person reads
 * the org profile, then the person's avatar). /about/<slug> is still the
 * person page (PersonPage) for each guide.
 */
export default async function AboutPage() {
  const data = await pageData(ABOUT_SLUG, DEFAULT_ABOUT_PAGE);
  if (!data) notFound();
  return <PuckPage slug={ABOUT_SLUG} data={data} />;
}
