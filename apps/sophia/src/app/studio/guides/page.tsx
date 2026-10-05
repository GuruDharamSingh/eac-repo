import type { Metadata } from "next";
import { StudioGuidesPage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Guides · Studio", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  return settle(await StudioGuidesPage({ c: connectors, q: await searchParams }), { permanent: false });
}
