import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireNetworkAdmin } from "@/lib/gate";
import { loadSitePage } from "@/lib/sites";
import { checkable } from "@/lib/sites-contracts";
import type { PageDoc } from "@/lib/sites-door";
import { SitePageView } from "@/components/sites/SitePageView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "A site's page" };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export default async function SitePage({ params }: { params: Promise<{ org: string; slug: string[] }> }) {
  const p = await params;
  const orgRef = decode(p.org);
  const slug = p.slug.map(decode).join("/");
  await requireNetworkAdmin(`/sites/${p.org}/${p.slug.join("/")}`);
  const data = await loadSitePage(orgRef, slug);
  if (!data) notFound();
  return (
    <div className="dev-page">
      <SitePageView
        orgId={data.org.id}
        orgName={data.org.name}
        slug={data.slug}
        live={data.live ? { data: data.live.data as PageDoc, version: data.live.version } : null}
        draft={
          data.draft
            ? { data: data.draft.data as PageDoc, savedAt: data.draft.savedAt, authorLabel: data.draft.author.label, authorKind: data.draft.author.kind, base: data.draft.base, note: data.draft.note ?? null, stepCount: data.draft.steps?.length ?? 0, steps: data.draft.steps ?? [] }
            : null
        }
        contracts={checkable().contracts}
        config={checkable().config}
      />
    </div>
  );
}
