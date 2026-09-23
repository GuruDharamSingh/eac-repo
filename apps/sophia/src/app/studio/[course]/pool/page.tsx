import type { Metadata } from "next";
import { StudioPoolPage } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

export const metadata: Metadata = { title: "The pool · Studio", robots: { index: false, follow: false } };
type Props = { params: Promise<{ course: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  return settle(await StudioPoolPage({ c: connectors, courseSlug: (await params).course, q: await searchParams }), { permanent: false });
}
