import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireKeeper } from "@/lib/marketplace-auth";
import { hubSite, getHubCardViewer } from "@/lib/hub-site";
import { CONTENT_SERVERS, type ContentPresetId } from "@/lib/content-cards";
import { ContentDetail } from "@/components/hub/cards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Content · Hub" };

/** A Content card's "Open page" under /hub (same as /admin/content?preset=…, closing back to /hub). */
export default async function HubContentPage({ searchParams }: { searchParams: Promise<{ preset?: string; tab?: string }> }) {
  await requireKeeper();
  const sp = await searchParams;
  const preset = sp.preset && sp.preset in CONTENT_SERVERS ? (sp.preset as ContentPresetId) : null;
  if (!preset) redirect("/hub");
  const viewer = await getHubCardViewer();
  if (!viewer) return null;
  const data = await CONTENT_SERVERS[preset].loadDetail(hubSite, viewer, { tab: sp.tab ?? null });
  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-8">
      <ContentDetail data={data} tab={sp.tab ?? null} links={{ hubBase: "/hub" }} closeHref="/hub" />
    </main>
  );
}
