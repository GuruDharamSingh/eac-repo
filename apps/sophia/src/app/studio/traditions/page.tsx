import type { Metadata } from "next";
import { StudioTraditionsPage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Traditions · Studio", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  return settle(await StudioTraditionsPage({ c: connectors, q: await searchParams }), { permanent: false });
}
