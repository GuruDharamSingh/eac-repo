import type { Metadata } from "next";
import { StudioWorkshopsPage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Workshops · Studio", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  return settle(await StudioWorkshopsPage({ c: connectors, q: await searchParams }), { permanent: false });
}
