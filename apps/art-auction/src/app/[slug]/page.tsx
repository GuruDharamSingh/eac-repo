import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { puckPageMetadata, renderPuckPage } from "@/lib/puck/render";

/**
 * A page designed in the page editor, at `/<slug>` (`/auction`, `/featured`).
 *
 * Only reached when no real route answers: every static route wins over this
 * one, and RESERVED_SLUGS (lib/puck/reserved.ts) keeps a page from being saved
 * under a name that is already a route. A template document is not a page and
 * is refused here.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return (await puckPageMetadata(slug)) ?? {};
}

export default async function DesignedPage({ params }: Props) {
  const { slug } = await params;
  const page = await renderPuckPage(slug);
  if (!page) notFound();
  // gap, not space-y: the blocks carry `m-0`, which beats space-y's margins.
  return <main className="mx-auto flex max-w-6xl flex-col gap-14 px-6 py-10">{page}</main>;
}
