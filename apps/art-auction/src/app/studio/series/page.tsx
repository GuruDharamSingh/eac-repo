import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  listSeriesForUser,
  listSeriesLots,
  listSeriesPublications,
  listWritingForUser,
} from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { AttachForm, DetachButton } from "./attach-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Auction series · My art" };

const PHASE: Record<string, string> = {
  draft: "not yet announced",
  announced: "announced — bidding opens soon",
  silent: "bidding open",
  live: "live close under way",
  closed: "closed",
};

/**
 * The Auction series tab (ORG_STORE_BRIEF D9, R8): the series this person
 * takes part in — as desk member, slot assignee or the artist of a lot — with
 * a live look at their lots and the publications attached. No obligations
 * are assigned and nothing blocks (R8); the desk messages people directly.
 */
export default async function MySeriesPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/studio/series");
  const [series, writing] = await Promise.all([listSeriesForUser(userId), listWritingForUser(userId)]);
  const net = siteConfig.network;

  if (series.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        You are not in an auction series yet. When one of your pieces joins a series, or a desk adds
        you, it appears here.
      </section>
    );
  }

  const details = await Promise.all(
    series.map(async (s) => {
      const [lots, pubs] = await Promise.all([listSeriesLots(s.id), listSeriesPublications(s.id)]);
      return { s, lots, pubs };
    })
  );

  return (
    <div className="space-y-12">
      {details.map(({ s, lots, pubs }) => {
        const myLots = lots.filter((l) => l.artistName != null); // all lots shown; mine marked below
        return (
          <section key={s.id} className="rounded-lg border border-border p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  {s.roles.map((r) => (r === "artist" ? "your work is in it" : r)).join(" · ")}
                </p>
                <h2 className="mt-1 font-serif text-2xl tracking-tight">{s.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {PHASE[s.phase] ?? s.phase}
                  {s.silentOpensAt ? ` · bidding opens ${new Date(s.silentOpensAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}` : ""}
                  {s.liveAt ? ` · live close ${new Date(s.liveAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}` : ""}
                </p>
              </div>
              <span className="flex gap-4 text-sm">
                <Link href={`/series/${s.slug}`} className="underline underline-offset-4">Landing page →</Link>
                {s.phase === "live" && <Link href={`/series/${s.slug}/live`} className="underline underline-offset-4">Live board →</Link>}
                {(s.roles.includes("editor")) && <Link href={`/series/${s.slug}/manage`} className="underline underline-offset-4">Workspace →</Link>}
              </span>
            </div>

            <h3 className="mt-6 text-xs uppercase tracking-[0.22em] text-muted-foreground">Lots ({myLots.length})</h3>
            {myLots.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No lots yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {myLots.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="text-muted-foreground">Lot {l.lotNumber ?? "—"}</span>{" "}
                      <Link href={`/lots/${l.id}`} className="underline-offset-4 hover:underline">{l.title}</Link>
                      {l.artistName && <span className="ml-2 text-xs text-muted-foreground">{l.artistName}</span>}
                    </span>
                    <span className="tabular-nums">
                      {l.currentBidMinor != null ? formatMoney(l.currentBidMinor, l.currency as "CAD") : `from ${formatMoney(l.startingBidMinor, l.currency as "CAD")}`}
                      <span className="ml-2 text-xs text-muted-foreground">{l.bidCount} {l.bidCount === 1 ? "bid" : "bids"} · {l.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-6 text-xs uppercase tracking-[0.22em] text-muted-foreground">Publications ({pubs.length})</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Writing about the series or your piece: attach something you have already published,
              or{" "}
              <a href={`${net.artsCollectiveUrl}/studio?kind=writing`} className="underline underline-offset-4">
                write something new in the Studio
              </a>
              .
            </p>
            {pubs.length > 0 && (
              <ul className="mt-2 divide-y divide-border text-sm">
                {pubs.map((p) => (
                  <li key={p.slotId} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {p.authorSlug && p.slug ? (
                        <a href={`${net.artdirectUrl}/${p.authorSlug}/writing/${p.slug}`} className="underline-offset-4 hover:underline">{p.title}</a>
                      ) : (
                        p.title
                      )}
                      {p.authorName && <span className="ml-2 text-xs text-muted-foreground">{p.authorName}</span>}
                      {p.weekNo && <span className="ml-2 text-xs text-muted-foreground">week {p.weekNo}</span>}
                    </span>
                    <DetachButton seriesId={s.id} slotId={p.slotId} />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <AttachForm seriesId={s.id} weekCount={s.weekCount} writing={writing.map((w) => ({ id: w.id, title: w.title }))} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
