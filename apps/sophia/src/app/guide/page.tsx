import type { Metadata } from "next";
import { GuidePage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Guide desk", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; course?: string; all?: string }> }) {
  const q = await searchParams;
  return settle(await GuidePage({ c: connectors, q, courseSlug: q.course, all: q.all === "1" }), { permanent: false });
}
