import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCourseKind } from "@elkdonis/lms";
import { CoursePage, courseMetadata } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

type Props = { params: Promise<{ course: string }>; searchParams: Promise<{ notice?: string; error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).course;
  // A workspace has one front door: its own page. Nothing about it is shown on the public course page.
  if ((await getCourseKind(slug)) === "workspace") return { title: "Workspace", robots: { index: false, follow: false } };
  return courseMetadata(connectors, slug);
}

export default async function Page({ params, searchParams }: Props) {
  const slug = (await params).course;
  if ((await getCourseKind(slug)) === "workspace") redirect(`/workspaces/${slug}`);
  return settle(await CoursePage({ c: connectors, courseSlug: slug, q: await searchParams }));
}
