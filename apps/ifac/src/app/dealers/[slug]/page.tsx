import type { Metadata } from "next";
import { listDirectorySlugs } from "@/lib/directory";
import { PersonView, personPageTitle } from "@/components/person-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ edit?: string }> };

export async function generateStaticParams() {
  const slugs = await listDirectorySlugs("dealer");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = await personPageTitle("dealers", slug);
  return title ? { title } : {};
}

/** Shares components/person-view.tsx with the /artists route. */
export default async function DealerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { edit } = await searchParams;
  return <PersonView kind="dealers" slug={slug} startEditing={edit === "1"} />;
}
