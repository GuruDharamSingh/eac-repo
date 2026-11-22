import type { Metadata } from "next";
import Link from "next/link";
import { IDEAS } from "@/ideas";
import { requireNetworkAdmin } from "@/lib/gate";

export const metadata: Metadata = { title: "Ideas" };
export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  await requireNetworkAdmin("/ideas");
  return (
    <div className="dev-page">
      <h1>Ideas</h1>
      <p className="dev-lede">A new idea, presented as something to try. One file per idea in src/ideas/, listed in src/ideas/index.ts.</p>
      <div className="dev-ideas-grid">
        {IDEAS.map((i) => (
          <Link key={i.slug} href={`/ideas/${i.slug}`} className="dev-card dev-idea-link">
            <span className="dev-status">{i.status}</span>
            <h3 style={{ marginTop: 8 }}>{i.title}</h3>
            <p className="dev-lede" style={{ margin: "4px 0" }}>
              {i.summary}
            </p>
            <span className="dev-src">{i.added}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
