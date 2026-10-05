import type { Metadata } from "next";
import { WorkshopsPage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";

export const metadata: Metadata = { title: "Workshops" };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  return WorkshopsPage({ c: connectors, q: await searchParams });
}
