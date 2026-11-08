import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PuckPage, pageData, titleOf } from "@/lib/puck/render";
import { READINGS_SLUG } from "@/lib/puck/store";
import { DEFAULT_READINGS_PAGE } from "@/lib/default-pages";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await pageData(READINGS_SLUG, DEFAULT_READINGS_PAGE);
  return {
    title: titleOf(data) ?? "Readings",
    description: "Enneagram readings and counselling with Ario, booked and paid in one step, and his writing.",
  };
}

/** /readings (round 3): the studio document `readings`, or DEFAULT_READINGS_PAGE. /services redirects here. */
export default async function ReadingsPage() {
  const data = await pageData(READINGS_SLUG, DEFAULT_READINGS_PAGE);
  if (!data) notFound();
  return <PuckPage slug={READINGS_SLUG} data={data} />;
}
