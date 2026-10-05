import type { Metadata } from "next";
import { GuidesPage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";

export const metadata: Metadata = { title: "Guides" };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; side?: string }> }) {
  const q = await searchParams;
  return GuidesPage({ c: connectors, q, side: q.side === "inner" || q.side === "outer" ? q.side : null });
}
