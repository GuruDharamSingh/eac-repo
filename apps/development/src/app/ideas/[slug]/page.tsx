import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ideaBySlug } from "@/ideas";
import { loadDesignSystem, loadThemes } from "@/lib/data";
import { requireNetworkAdmin } from "@/lib/gate";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const idea = ideaBySlug((await params).slug);
  return { title: idea?.title ?? "Idea" };
}

export default async function IdeaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireNetworkAdmin(`/ideas/${slug}`);
  const idea = ideaBySlug(slug);
  if (!idea) notFound();
  const { Component } = idea;
  return (
    <div className="dev-page">
      <Link href="/ideas" className="dev-back">
        All ideas
      </Link>
      <h1 style={{ marginTop: 8 }}>{idea.title}</h1>
      <p className="dev-lede">
        <span className="dev-status">{idea.status}</span> {idea.summary}
      </p>
      <Component designSystem={loadDesignSystem()} themes={loadThemes()} />
      {idea.refs?.length ? (
        <p className="dev-src" style={{ marginTop: 32 }}>
          Sources: {idea.refs.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
