import type { Metadata } from "next";
import { StudioStepPage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Studio", robots: { index: false, follow: false } };
type Props = { params: Promise<{ course: string; stepId: string }>; searchParams: Promise<{ notice?: string; error?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const p = await params;
  return settle(await StudioStepPage({ c: connectors, courseSlug: p.course, stepId: p.stepId, q: await searchParams }), { permanent: false });
}
