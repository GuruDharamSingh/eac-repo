import type { Metadata } from "next";
import { SharePostView } from "@/components/mobile/share-post-view";
import { requireOrgEditor } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Share on Discover", robots: { index: false, follow: false } };

/** Screen 39. Guides share a post or a link (held for the office when the site setting says so); the office publishes at once. */
export default async function SharePage() {
  const viewer = await requireOrgEditor();
  return (
    <div className="elk-m">
      <SharePostView isOffice={viewer.role === "owner"} />
    </div>
  );
}
