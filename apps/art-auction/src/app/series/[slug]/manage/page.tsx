import Link from "next/link";
import { getSeriesOverview, getSeriesMoney, listSeriesArtists, listWeekBoards, listSeriesActivity } from "@elkdonis/commerce/server";
import { loadWorkspace } from "./load";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "[date]");
const money = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n / 100);

/** Overview (mock-up 1): where the series is in its course, figures, what is ready, what needs attention. */
export default async function OverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { series } = await loadWorkspace(slug);
  const base = `/series/${series.slug}/manage`;
  const [o, m, artists, weeks, activity] = await Promise.all([
    getSeriesOverview(series.id),
    getSeriesMoney(series.id),
    listSeriesArtists(series.id),
    listWeekBoards(series.id),
    listSeriesActivity(series.id),
  ]);

  const owedToArtists = Math.max(0, m.toArtistsMinor - m.paidAtSourceMinor);
  const settling = series.phase === "closed" || (series.liveAt != null && Date.now() > new Date(series.liveAt).getTime());
  const stages = [
    { label: "Draft", note: series.status === "draft" ? "now" : "done", done: true },
    { label: "Announced", note: fmt(series.announceAt), done: ["announced", "silent", "live", "closed"].includes(series.phase) },
    { label: "Silent bidding", note: fmt(series.silentOpensAt), done: ["silent", "live", "closed"].includes(series.phase) },
    { label: "Live close", note: fmt(series.liveAt), done: ["live", "closed"].includes(series.phase) },
    { label: "Settling", note: "payments, hand-over", done: settling },
    { label: "Closed", note: "when every lot is done", done: series.status === "closed" },
  ];

  const checklist = [
    { done: o.datesSet, label: "Bidding and live-close dates", href: `${base}/rules`, act: "Set" },
    { done: o.hasHero, label: "Cover image or video", href: `${base}/page`, act: "Add" },
    { done: o.hasDescription, label: "Curator's write-up", href: `${base}/page`, act: "Write" },
    { done: o.weeksPlanned >= series.weekCount, label: `Week themes (${o.weeksPlanned} of ${series.weekCount})`, href: `${base}/weeks`, act: "Plan" },
    { done: o.lotCount > 0 && o.lotsWithoutImage === 0, label: o.lotCount === 0 ? "Lots" : o.lotsWithoutImage === 0 ? `${o.lotCount} lot${o.lotCount === 1 ? "" : "s"}, all with images` : `${o.lotsWithoutImage} lot${o.lotsWithoutImage === 1 ? " has" : "s have"} no image`, href: `${base}/lots`, act: o.lotCount === 0 ? "Add" : "Fix" },
    { done: o.editorCount > 0, label: `Team (${o.editorCount} editor${o.editorCount === 1 ? "" : "s"})`, href: `${base}/team`, act: "Manage" },
  ];

  const noPayout = artists.filter((a) => a.userId && a.role === "maker" && !a.stripe && !a.payoutEmail && !a.payoutMethod).length;
  const nameOnly = artists.filter((a) => !a.userId).length;
  const emptyWeeks = weeks.filter((w) => w.items.length === 0).map((w) => w.weekNo);
  const attention: Array<{ text: string; href: string; act: string }> = [];
  if (noPayout > 0) attention.push({ text: `${noPayout} artist${noPayout === 1 ? " has" : "s have"} no payout method yet. Their proceeds will be held and paid by hand.`, href: `${base}/artists`, act: "See artists" });
  if (nameOnly > 0) attention.push({ text: `${nameOnly} artist${nameOnly === 1 ? " is" : "s are"} listed by name only (no account); ${series.presenterName ?? "the presenter"} pays them by hand.`, href: `${base}/artists`, act: "See artists" });
  if (emptyWeeks.length > 0) attention.push({ text: `Week${emptyWeeks.length === 1 ? "" : "s"} ${emptyWeeks.join(", ")} ${emptyWeeks.length === 1 ? "has" : "have"} no content scheduled.`, href: `${base}/weeks`, act: "Add content" });
  if (m.awaitingMinor > 0) attention.push({ text: `${money(m.awaitingMinor)} is still to be collected from winning bidders.`, href: `${base}/orders`, act: "See orders" });
  if (series.status === "draft" && o.datesSet && o.lotCount > 0) attention.push({ text: "The series is a draft: only the team can see its page.", href: `/series/${series.slug}`, act: "Preview" });

  return (
    <>
      <div>
        <h1 className="sw-h1">Overview</h1>
        <p className="sw-sub">
          {series.presenterName ? `Presented by ${series.presenterName}` : "No presenting organisation"}
          {series.hostName ? ` · hosted by ${series.hostName}` : ""} · {series.weekCount} week{series.weekCount === 1 ? "" : "s"}
        </p>
      </div>

      <section aria-label="Timeline" className="sw-card">
        <div className="sw-timeline">
          {stages.map((s) => (
            <div key={s.label} className={s.done ? "is-done" : undefined}>
              <div className="sw-timeline-label">{s.label}</div>
              <div className="sw-muted sw-small">{s.note}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="sw-grid cols-6">
        {[
          ["Lots", String(o.lotCount)],
          ["Artists", String(o.artistCount)],
          ["Bids", String(o.bidCount)],
          ["Total bid", money(o.highBidTotalMinor)],
          ["To collect", money(m.awaitingMinor)],
          ["Owed to artists", money(owedToArtists)],
        ].map(([k, v]) => (
          <div key={k} className="sw-stat"><div className="sw-stat-label">{k}</div><div className="sw-stat-value">{v}</div></div>
        ))}
      </div>

      <div className="sw-row">
        <section className="sw-card">
          <h2 className="sw-h2">{series.status === "draft" ? "Before you publish" : "Set-up"}</h2>
          <ul className="sw-list">
            {checklist.map((c) => (
              <li key={c.label}>
                <span><span className={c.done ? "sw-state-done" : "sw-state-todo"}>{c.done ? "Done" : "To do"}</span> · {c.label}</span>
                <Link href={c.href}>{c.done ? "Edit" : c.act}</Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="sw-card">
          <h2 className="sw-h2">Needs attention</h2>
          {attention.length === 0 ? <p className="sw-muted" style={{ margin: 0 }}>Nothing at the moment.</p> : (
            <ul className="sw-bullets" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              {attention.map((a) => <li key={a.text}>{a.text} <Link href={a.href}>{a.act}</Link></li>)}
            </ul>
          )}
          <h2 className="sw-h2" style={{ marginTop: 20 }}>Recent activity</h2>
          {activity.length === 0 ? <p className="sw-muted" style={{ margin: 0 }}>No activity yet.</p> : (
            <ul className="sw-muted" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {activity.map((a, i) => <li key={i}>{a.text} <span className="sw-small">· {new Date(a.at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span></li>)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
