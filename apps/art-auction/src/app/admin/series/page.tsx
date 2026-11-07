import Link from "next/link";
import type { Metadata } from "next";
import { listSeries } from "@elkdonis/commerce/queries";
import { canCreateSeries } from "@elkdonis/commerce/server";
import { getCurrentUserId, requireAdmin } from "@/lib/marketplace-auth";
import { NewSeriesForm } from "./series-panels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auction series · Admin" };

const PHASE_LABEL: Record<string, string> = {
  draft: "draft",
  announced: "announced",
  silent: "silent bidding",
  live: "live close",
  closed: "closed",
};

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default async function AdminSeriesPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireAdmin();
  const userId = await getCurrentUserId();
  const [series, mayCreate] = await Promise.all([
    listSeries({ orgId: "market" }),
    userId ? canCreateSeries(userId) : Promise.resolve(false),
  ]);

  return (
    <section>
      <h2 className="mb-1 font-serif text-2xl tracking-tight">
        Auction series
        <span className="ml-2 text-base text-muted-foreground">({series.length})</span>
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        A seasonal auction: a landing page, weeks with a focus, a desk team and the lots in it.
        The series&rsquo; dates set every lot&rsquo;s clock. Open one for its manage page and the
        Help tab.
      </p>

      {series.length === 0 ? (
        <p className="mb-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No series yet.
        </p>
      ) : (
        <div className="mb-8 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Series</th>
                <th className="px-4 py-2 font-medium">Phase</th>
                <th className="px-4 py-2 font-medium">Bidding opens</th>
                <th className="px-4 py-2 font-medium">Live close</th>
                <th className="px-4 py-2 text-right font-medium">Lots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {series.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link href={`/series/${s.slug}/manage`} className="font-medium underline-offset-4 hover:underline">
                      {s.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">/series/{s.slug}</span>
                  </td>
                  <td className="px-4 py-2">{PHASE_LABEL[s.phase] ?? s.phase}{s.status === "draft" ? " (unpublished)" : ""}</td>
                  <td className="px-4 py-2 text-muted-foreground">{fmt(s.silentOpensAt)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{fmt(s.liveAt)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.lotCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mayCreate && <NewSeriesForm />}
    </section>
  );
}
