import type { Metadata } from "next";
import { CoursePage, courseMetadata } from "@elkdonis/lms-ui";
import { connectors } from "@/lib/connectors";
import { settle } from "@/lib/settle";

type Props = { params: Promise<{ course: string }>; searchParams: Promise<{ notice?: string; error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return courseMetadata(connectors, (await params).course);
}

export default async function Page({ params, searchParams }: Props) {
  return settle(await CoursePage({ c: connectors, courseSlug: (await params).course, q: await searchParams }));
}
