import type { Metadata } from "next";
import { StepPage, stepMetadata } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

type Props = { params: Promise<{ course: string; step: string }>; searchParams: Promise<{ notice?: string; error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  return stepMetadata(connectors, p.course, p.step);
}

export default async function Page({ params, searchParams }: Props) {
  const p = await params;
  return settle(await StepPage({ c: connectors, courseSlug: p.course, stepSlug: p.step, q: await searchParams }));
}
