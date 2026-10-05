import type { Metadata } from "next";
import { TraditionsPage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";

export const metadata: Metadata = { title: "Traditions" };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  return TraditionsPage({ c: connectors, q: await searchParams });
}
