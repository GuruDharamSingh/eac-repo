import type { Metadata } from "next";
import { StudioCoursePage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "Studio", robots: { index: false, follow: false } };
type Props = { params: Promise<{ course: string }>; searchParams: Promise<{ notice?: string; error?: string }> };

export default async function Page({ params, searchParams }: Props) {
  return settle(await StudioCoursePage({ c: connectors, courseSlug: (await params).course, q: await searchParams }), { permanent: false });
}
