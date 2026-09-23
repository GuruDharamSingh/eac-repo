import type { Metadata } from "next";
import { CataloguePage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { SOPHIA_URL } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: SOPHIA_URL } };

export default async function Home({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  return CataloguePage({ c: connectors, q: await searchParams });
}
