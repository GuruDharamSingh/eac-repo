import type { Metadata } from "next";
import { CataloguePage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";

export const metadata: Metadata = { title: "All courses" };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  return CataloguePage({ c: connectors, q: await searchParams });
}
