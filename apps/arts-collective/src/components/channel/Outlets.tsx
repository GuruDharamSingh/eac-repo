"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Radio } from "lucide-react";
import { ConnectionsPanel, createConnectionsConnectors } from "@elkdonis/cms-ui/surface";
import { fmtDay, fmtLong, type Outlet, type Piece, type TimelineEntry } from "@/lib/channel/model";
import { CHANNEL_BASE, useChannel } from "./context";
import { IdentityMark, OutletIcon } from "./icons";
import { NextChip, StatusTag } from "./bits";
import { outletLabel } from "./labels";

import { OUTLET_TABS, type OutletTab } from "./outlet-tabs";

export { OUTLET_TABS, type OutletTab };

const SOCIAL: OutletTab[] = ["instagram", "facebook", "threads", "youtube"];

/** Which timeline outlets count as "this outlet" for a tab. */
const MATCH: Record<OutletTab, Outlet[]> = {
  site: ["site", "page", "market"],
  instagram: ["instagram"],
  facebook: ["facebook"],
  threads: ["threads"],
  youtube: ["youtube", "video"],
  live: ["live"],
  newsletter: ["newsletter"],
};

/**
 * Outlets: one page per place work goes, as tabs. Each tab shows the accounts
 * it goes out through (and Connect, for the socials), what went there, what is
 * planned for it, and the pieces not there yet. The Connections panel is the
 * same component and the same routes as the Center's Connections tab.
 */
export function Outlets({ tab }: { tab: OutletTab }) {
  const { model, href, identity } = useChannel();
  const status = model.outlets.find((o) => o.id === tab) ?? null;
  const entries: Array<{ piece: Piece; e: TimelineEntry }> = [];
  for (const p of model.pieces) for (const e of p.timeline) if (MATCH[tab].includes(e.outlet)) entries.push({ piece: p, e });
  const went = entries.filter((x) => x.e.state === "published").sort((a, b) => b.e.at.localeCompare(a.e.at)).slice(0, 12);
  const planned = entries.filter((x) => (x.e.state === "scheduled" || x.e.state === "live" || x.e.state === "draft") && x.e.deliveryId).sort((a, b) => a.e.at.localeCompare(b.e.at));
  const failed = entries.filter((x) => x.e.state === "failed").slice(0, 5);
  const gaps = model.pieces.flatMap((p) => p.suggestions.filter((s) => MATCH[tab].includes(s.outlet)).map((s) => ({ p, s }))).slice(0, 8);

  return (
    <div className="chn-page">
      <nav className="chn-crumbs" aria-label="Breadcrumb">
        <Link href={href(CHANNEL_BASE)}>Channel</Link> / <span aria-current="page">Outlets</span>
      </nav>
      <header className="chn-head">
        <div>
          <h1>Outlets</h1>
          <p>Where work goes, the accounts it goes out through, and what is waiting for each.</p>
        </div>
      </header>

      <nav className="chn-tabs chn-outlet-tabs" aria-label="Outlets">
        {OUTLET_TABS.map((t) => {
          const o = model.outlets.find((x) => x.id === t);
          return (
            <Link key={t} href={href(`${CHANNEL_BASE}/outlets`, { tab: t })} aria-current={t === tab ? "page" : undefined}>
              <OutletIcon outlet={t} size={15} /> {t === "newsletter" ? "Newsletter" : outletLabel(t)}
              {o && SOCIAL.includes(t) && !o.connected && <small className="chn-outlet-off">not connected</small>}
              {t === "instagram" && o?.left != null && <small>{o.left} of 25</small>}
            </Link>
          );
        })}
      </nav>

      <div className="chn-outlet">
        <section className="chn-outlet-main">
          <OutletIntro tab={tab} />

          {tab === "live" && <LivePanel />}

          <h2 className="chn-kicker">Planned here</h2>
          {planned.length === 0 ? (
            <p className="chn-empty-line">Nothing planned for {tab === "newsletter" ? "the newsletter" : outletLabel(tab)} yet.</p>
          ) : (
            <ol className="chn-timeline">
              {planned.map(({ piece, e }) => (
                <li key={e.id}>
                  <span className="chn-tl-date">{fmtDay(e.at, model.timeZone)}</span>
                  <span className="chn-tl-id">{(() => { const i = identity(e.identityId); return i ? <IdentityMark initials={i.initials} kind={i.kind} title={i.name} /> : null; })()}</span>
                  <OutletIcon outlet={e.outlet} state={e.state} size={16} />
                  <span className="chn-tl-text">
                    {e.label}
                    <small>{piece.title} · {e.sub}</small>
                  </span>
                  <StatusTag state={e.state} />
                </li>
              ))}
            </ol>
          )}

          {gaps.length > 0 && (
            <>
              <h2 className="chn-kicker">Not here yet</h2>
              <ul className="chn-outlet-gaps">
                {gaps.map(({ p, s }) => (
                  <li key={s.id}>
                    <span>
                      <strong>{p.title}</strong>
                      <small>{s.reason}</small>
                    </span>
                    <NextChip suggestion={s} piece={p} compact />
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="chn-kicker">What went here</h2>
          {went.length === 0 ? (
            <p className="chn-empty-line">Nothing has gone out here yet.</p>
          ) : (
            <ol className="chn-timeline">
              {went.map(({ piece, e }) => (
                <li key={e.id}>
                  <span className="chn-tl-date">{fmtDay(e.at, model.timeZone)}</span>
                  <span className="chn-tl-id">{(() => { const i = identity(e.identityId); return i ? <IdentityMark initials={i.initials} kind={i.kind} title={i.name} /> : null; })()}</span>
                  <OutletIcon outlet={e.outlet} state={e.state} size={16} />
                  <span className="chn-tl-text">
                    {e.href ? (
                      <a href={e.href} target="_blank" rel="noreferrer">
                        {piece.title}
                      </a>
                    ) : (
                      piece.title
                    )}
                    <small>{e.label} · {e.sub}</small>
                  </span>
                  <StatusTag state={e.state} />
                </li>
              ))}
            </ol>
          )}
          {failed.length > 0 && (
            <>
              <h2 className="chn-kicker">Did not go out (last 30 days)</h2>
              <ul className="chn-plain">
                {failed.map(({ piece, e }) => (
                  <li key={e.id} className="is-alert">
                    {fmtLong(e.at, model.timeZone)} · {piece.title}: {e.sub}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="chn-quiet chn-outlet-now">Counted from the pieces this channel shows (the latest 160 threads and 120 works).</p>
        </section>

        <aside className="chn-outlet-side">
          <h2 className="chn-kicker">Goes out as</h2>
          <ul className="chn-plain chn-outlet-ids">
            {model.identities.map((i) => {
              const on = tab === "site" || tab === "newsletter" || tab === "live" ? true : Boolean(status?.identityIds.includes(i.id));
              return (
                <li key={i.id} data-on={on ? "1" : "0"}>
                  <IdentityMark initials={i.initials} kind={i.kind} size={18} /> {i.kind === "user" ? `${i.name} (you)` : i.name}
                  <small>{tab === "site" ? i.siteHost ?? "no site yet" : on ? "connected" : "not connected"}</small>
                </li>
              );
            })}
          </ul>
          {status && status.accounts.length > 0 && SOCIAL.includes(tab) && (
            <>
              <h2 className="chn-kicker">Accounts</h2>
              <ul className="chn-plain">
                {status.accounts.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </>
          )}
          {SOCIAL.includes(tab) && <Connect />}
          {tab === "site" && <SiteLinks />}
          {tab === "newsletter" && model.links.newsletter && (
            <a className="chn-btn" href={model.links.newsletter}>
              Open the email suite <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}

function OutletIntro({ tab }: { tab: OutletTab }) {
  const { model } = useChannel();
  const o = model.outlets.find((x) => x.id === tab);
  const text: Record<OutletTab, string> = {
    site: "Your page on the directory, your orgs' sites and the market. A piece goes here first; the socials link back to it.",
    instagram: "Pictures go out as JPEG; links in captions are not clickable, so they become “link in bio”. 25 posts per account in any 24 hours.",
    facebook: "Posts to a Page. Facebook reads the link preview from the site, so Facebook goes after the site.",
    threads: "Text posts with a link, from the connected Threads profile.",
    youtube: "Uploads go to the connected channel; recordings and reels can be published here from the Studio.",
    live: "A live is planned like any other post: on a piece, in a slot, or before its date. It shows on the Queue and the piece's board.",
    newsletter: "Letters go out from the email suite to an org's followers. A letter routine opens a slot each time it comes round.",
  };
  return (
    <p className="chn-outlet-intro">
      {text[tab]}
      {tab === "instagram" && o?.left != null ? ` ${o.left} of 25 left now, counted from this platform's own posts.` : ""}
    </p>
  );
}

function Connect() {
  const api = React.useMemo(() => createConnectionsConnectors({ route: "/api/center/connections", startUrl: "/api/connections/start" }), []);
  const [returnTo, setReturnTo] = React.useState<string | undefined>(undefined);
  React.useEffect(() => setReturnTo(window.location.href), []);
  return (
    <div className="chn-connect">
      <h2 className="chn-kicker">Connect</h2>
      <ConnectionsPanel api={api} returnTo={returnTo} intro={<p className="chn-quiet">Your own accounts. An org posts through a Page or account you set as its channel.</p>} />
    </div>
  );
}

function SiteLinks() {
  const { model } = useChannel();
  return (
    <ul className="chn-plain chn-outlet-links">
      {model.identities
        .filter((i) => i.siteUrl)
        .map((i) => (
          <li key={i.id}>
            <a href={i.siteUrl!} target="_blank" rel="noreferrer">
              {i.siteName} <ExternalLink size={12} aria-hidden />
            </a>
          </li>
        ))}
      {model.links.pages && (
        <li>
          <a href={model.links.pages}>Pages and editor</a>
        </li>
      )}
    </ul>
  );
}

function LivePanel() {
  const { model } = useChannel();
  const yt = model.outlets.find((o) => o.id === "youtube");
  const fb = model.outlets.find((o) => o.id === "facebook");
  return (
    <div className="chn-live-panel">
      <ul className="chn-plain">
        <li>
          <Radio size={14} aria-hidden className="is-live" /> {model.nextLive ? `Next live: ${model.nextLive.title}, ${fmtLong(model.nextLive.at, model.timeZone)}` : "No live planned."}
        </li>
        <li>YouTube Live: {yt?.connected ? `through ${yt.accounts[0] ?? "your channel"}` : "connect a YouTube channel first"}.</li>
        <li>Facebook Live: {fb?.connected ? `through ${fb.accounts[0] ?? "your Page"}` : "connect a Facebook Page first"}.</li>
      </ul>
      {model.viewer.isAdmin ? (
        <a className="chn-btn" href={model.links.live}>
          <Radio size={15} aria-hidden className="is-live" /> Open the broadcast booth
        </a>
      ) : (
        <p className="chn-quiet">Going live runs from the broadcast booth, which is open to network admins for now. A live you plan here is on the Queue and the piece's board for whoever runs the booth.</p>
      )}
    </div>
  );
}
