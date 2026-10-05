import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CLAIM_VERDICTS, claimStats, loadClaimPassage, nextClaimTextId, CLAIM_TEXT_MAX } from "@elkdonis/astro-corpus/server";
import { requireStudioReviewer } from "@/lib/auth";
import { ClaimsCard } from "@/components/studio/claims-card";

export const metadata: Metadata = { title: "Check AI claims · Studio" };
export const dynamic = "force-dynamic";

/**
 * "Check AI claims": one imported passage at a time with every claim the
 * digest (an AI first pass) made from it, judged next to the passage. The
 * queue (src/claims.ts) picks passages whose claims touch your charts first.
 * The chosen passage is pinned in the URL (?t=), so saving a verdict
 * refreshes the same passage; "Next passage" draws a new one.
 */
export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const viewer = await requireStudioReviewer("/hub/studio/claims");
  const sp = await searchParams;

  if (!sp.t) {
    const id = await nextClaimTextId(viewer.userId);
    if (id) redirect(`/hub/studio/claims?t=${id}`);
  }
  const [passage, stats] = await Promise.all([sp.t ? loadClaimPassage(sp.t, viewer.userId) : Promise.resolve(null), claimStats(viewer.userId)]);
  if (sp.t && !passage) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/hub/studio" className="text-sm text-muted-foreground hover:text-primary">
          ← Studio
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-gold">Check AI claims</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {stats.checked.toLocaleString()} passages checked · {stats.touchingMine.toLocaleString()} touch your charts · {stats.passages.toLocaleString()} in all
      </p>

      {passage ? (
        <ClaimsCard key={passage.textId} passage={passage} verdicts={[...CLAIM_VERDICTS]} textMax={CLAIM_TEXT_MAX} />
      ) : (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <p>Every passage with AI claims has been checked.</p>
          <Link href="/hub/studio" className="mt-3 inline-block text-primary">
            Back to the studio
          </Link>
        </div>
      )}
    </div>
  );
}
