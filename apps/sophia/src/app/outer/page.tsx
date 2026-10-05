import type { Metadata } from "next";
import { SidePage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";

export const metadata: Metadata = { title: "Outer · Art and classes" };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  return SidePage({ c: connectors, q: await searchParams, side: "outer" });
}
