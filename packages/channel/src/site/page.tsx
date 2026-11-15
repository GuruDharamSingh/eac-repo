import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { ActionResult } from "@elkdonis/actions";
import { handoffUrl } from "@elkdonis/auth-server";
import { listContent, type ContentListItem, type ContentType } from "@elkdonis/content/server";
import { setStudioBackParams } from "@elkdonis/utils/studio-back";
import { PIECE_KINDS, type ChannelModel, type Piece, type PieceKind } from "../model";
import { channelNextMoves } from "../next";
import { BoardTab, OutTab, PieceSummary, QueueTab, type QueueView } from "./tabs";
import { ChannelDoor, NextMoves, type SiteMove } from "./runs";
import { ChannelHome } from "./home";
import { SITE_NEXT_RUNS, outRows, studioKindOf, type SiteLinks } from "./view";
import type { RowLinks } from "./grid-data";
import { typeLabel } from "@elkdonis/content/registry";
import "@elkdonis/content/summary.css";
import "@elkdonis/content/content.css";
import "./site.css";

/**
 * Channel on an org's own site (developer, 2026-11-12; docs/open/CHANNEL_ON_SITES_2026-11-12.md):
 * Home (next moves, recent pieces), Queue (by piece: Accept / Plan it / Dismiss, today's routine
 * slots), Board (confirmed coverage matrix with the piece summary sheet), Out (what went where)
 * and Library, in the site's own look (the site's shadcn tokens; `.kch` in site.css). Deeper
 * edits go to the network Studio, which sends the person back through `back`; posting to
 * outlets stays on arts-collective (question 6). Built on katie-the-potter, 2026-11-14 (design
 * canvas "Studio pipeline frame", artboards D, D2, E), shared for sunjay and the rest.
 *
 * The site's route keeps auth: it signs the person in, gates on its own editor roles, then
 * renders this with its org, its door (a "use server" wrapper over performSiteChannelAction)
 * and its loader (siteChannelLoader in ./server).
 */

export interface SiteChannelParams {
  to?: string;
  tab?: string;
  type?: string;
  kind?: string;
  piece?: string;
  outlet?: string;
  failed?: string;
  cursor?: string;
  sheet?: string;
  id?: string;
  /**
   * The page's view: home | board | queue | out | library (2026-11-15). `tab` is its old name, kept as an alias;
   * `tab=plan|overview` with `piece` names the piece's own view, as on arts-collective's Channel (Studio's "Plan it").
   * An old `view=week|piece` still means the Queue's option.
   */
  view?: string;
  /** The Queue by "week" (the default) or "piece". */
  by?: string;
  /** The week the Queue shows, "YYYY-MM-DD" (any day in it). */
  week?: string;
  /** Queue by piece: the piece shown (a piece key; `piece` stays the manage-piece pop-up). */
  focus?: string;
  /** "1": the manage-piece pop-up shows the site's quick form (Edit). */
  edit?: string;
  /** Home: the pieces as "covers" (default) or a "list"; the Board by "outlets" (default) or the "week". */
  pieces?: string;
  board?: string;
}

/** A site's own quick form beside the tabs ("Edit here"; canvas D's right-hand sheet). */
export interface EditHere {
  /** Channel piece kinds it edits ("artwork", "product"; "meeting"). */
  kinds: readonly PieceKind[];
  /** Library content types that get "Edit here". */
  libraryTypes: readonly ContentType[];
  /** New ▾ entry for a new one here: "Artwork, here". */
  newLabel: string;
  /** Studio kind for the sheet's "More options in Studio". */
  studioKind: string;
  render(o: { id: string | null; closeHref: string; studioHref: string }): ReactNode;
}

export interface ChannelSitePageProps {
  org: { id: string; name: string };
  viewer: { userId: string; email: string };
  /** This site's origin (`https://pottery.arts-collective.com`), for Studio's way back. */
  origin: string;
  /** `https://arts-collective.com`. */
  networkUrl: string;
  searchParams: SiteChannelParams;
  /** The site's Channel door ("use server"). */
  run: (id: string, input: unknown) => Promise<ActionResult>;
  /**
   * The site's org channel for this viewer (siteChannelLoader(...).load). `week` (2026-11-15) is the
   * Queue's week view; a loader that ignores it shows the current week.
   */
  loadModel: (opts?: { week?: string }) => Promise<ChannelModel>;
  editHere?: EditHere | null;
}

type Tab = "home" | "queue" | "board" | "out" | "library";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "home", label: "Home" },
  // Board and Queue side by side: a toggle over the same table (developer, 2026-11-15).
  { id: "board", label: "Board" },
  { id: "queue", label: "Queue" },
  { id: "out", label: "Out" },
  { id: "library", label: "Library" },
];

const TYPE_FILTERS: Array<{ id: ContentType; label: string }> = [
  { id: "artwork", label: "Artwork" },
  { id: "writing", label: "Writing" },
  { id: "meeting", label: "Meetings" },
  { id: "series", label: "Series" },
  { id: "event", label: "Events" },
  { id: "workshop", label: "Workshops" },
];
const TYPE_IDS = new Set<string>(TYPE_FILTERS.map((t) => t.id));
const KIND_IDS = new Set<string>(PIECE_KINDS.map((k) => k.id));
const OUT_IDS = new Set(["site", "shop", "page", "instagram", "facebook", "letter"]);

/** Studio's `kind` for a library item (arts-collective StudioApp STUDIO_KIND_OF; meeting since 2026-11-14). */
const STUDIO_KIND: Partial<Record<ContentType, string>> = {
  writing: "writing",
  meeting: "meeting",
  artwork: "artwork-form",
};

export async function ChannelSitePage({ org, viewer, origin, networkUrl, searchParams: sp, run, loadModel, editHere = null }: ChannelSitePageProps) {
  const ORG = org.id;
  const ORG_Q = encodeURIComponent(ORG);
  if (sp.to === "outlets") redirect(handoffUrl(`${networkUrl}/channel/outlets?org=${ORG_Q}&tab=instagram`));

  const isView = (v: string | undefined): v is Tab => TABS.some((t) => t.id === v);
  const tab: Tab = isView(sp.view) ? sp.view : isView(sp.tab) ? sp.tab : "home";
  /** The piece's own view in the pop-up (`tab=plan`), as arts-collective's Channel names it. */
  const pieceView = sp.tab === "plan" || sp.tab === "overview" ? sp.tab : null;
  const type = sp.type && TYPE_IDS.has(sp.type) ? (sp.type as ContentType) : null;
  const kind = sp.kind && KIND_IDS.has(sp.kind) ? (sp.kind as PieceKind) : null;
  // `sheet=artwork` is katie's first spelling (2026-11-12), kept for old links.
  const sheet = editHere && (sp.sheet === "edit" || sp.sheet === "artwork") && tab !== "home" && tab !== "out" ? "edit" : null;
  const sheetId = sheet && sp.id && /^[A-Za-z0-9_-]{1,64}$/.test(sp.id) ? sp.id : null;
  const pieceKey = sp.piece && /^(thread|artwork):[A-Za-z0-9_-]{1,64}$/.test(sp.piece) ? sp.piece : null;
  const outlet = sp.outlet && OUT_IDS.has(sp.outlet) ? sp.outlet : null;
  const failedOnly = sp.failed === "1";
  const queueView: QueueView = tab === "queue" && (sp.by === "piece" || sp.view === "piece") ? "piece" : "week";
  const week = tab === "queue" && sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : undefined;
  const focus = queueView === "piece" && sp.focus && /^(thread|artwork):[A-Za-z0-9_-]{1,64}$/.test(sp.focus) ? sp.focus : null;
  const here = `${origin}/channel`;
  const backLabel = org.name;

  const links: SiteLinks = {
    tab(id, extra = {}) {
      const q = new URLSearchParams();
      if (id !== "home") q.set("view", id);
      for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
      const s = q.toString();
      return s ? `/channel?${s}` : "/channel";
    },
    studio(o = {}) {
      const q = new URLSearchParams();
      q.set("org", ORG);
      if (o.kind) q.set("kind", o.kind);
      if (o.id) q.set("id", o.id);
      setStudioBackParams(q, { back: here, backLabel });
      return handoffUrl(`${networkUrl}/studio?${q.toString()}`);
    },
    makeInto(from, to) {
      const q = new URLSearchParams({ from, to, org: ORG });
      setStudioBackParams(q, { back: here, backLabel });
      return handoffUrl(`${networkUrl}/studio/make?${q.toString()}`);
    },
    network(path) {
      return handoffUrl(`${networkUrl}${path}`);
    },
  };
  const itemStudioUrl = (it: ContentListItem): string => {
    const id = it.key.slice(it.key.indexOf(":") + 1);
    const k = STUDIO_KIND[it.type];
    return k ? links.studio({ kind: k, id }) : links.studio();
  };

  // One read of the shared Channel model for the site's org: the Next row, the tab counts,
  // and the Queue, Board and Out tabs.
  const model: ChannelModel | null = await loadModel(week ? { week } : undefined).catch((err) => {
    console.error(`[channel/site ${ORG}] model:`, err);
    return null;
  });
  const queued = model ? model.pieces.reduce((n, p) => n + p.suggestions.length, 0) : 0;
  const failed = model ? outRows(model).filter((r) => r.entry.state === "failed").length : 0;
  const badge: Partial<Record<Tab, number>> = { queue: queued, out: failed };

  const list =
    tab === "library"
      ? await listContent(
          { userId: viewer.userId },
          {
            orgId: ORG,
            limit: 40,
            ...(tab === "library" && type ? { types: [type] } : {}),
            ...(tab === "library" && sp.cursor ? { cursor: sp.cursor } : {}),
          },
        ).catch((err) => {
          console.error(`[channel/site ${ORG}] listContent:`, err);
          return null;
        })
      : null;

  // Next row: links that point at the network host go through the hand-off; Studio links carry the way back.
  const networkHref = (href: string | null): string | null => {
    if (!href) return null;
    if (/^https?:\/\//.test(href)) return href;
    if (!href.startsWith("/")) return null;
    const u = new URL(href, networkUrl);
    if (u.pathname === "/studio" || u.pathname.startsWith("/studio/")) setStudioBackParams(u.searchParams, { back: here, backLabel });
    return handoffUrl(u.toString());
  };
  const moves: SiteMove[] | null =
    tab === "home" && model
      ? channelNextMoves(model, { limit: 8 }).map((m) => ({
          id: m.id,
          kicker: m.kicker,
          title: m.title,
          reason: m.reason,
          run: m.run && SITE_NEXT_RUNS.includes(m.run.id) ? m.run : null,
          openHref: networkHref(m.href),
          openLabel: m.open?.kind === "studio" ? m.open.label : "Open in Channel",
        }))
      : null;

  /** Each next move's piece, so Home's kind chips filter the next row too (one chip behaviour). */
  const movePieces: Record<string, string | null> =
    tab === "home" && model ? Object.fromEntries(channelNextMoves(model, { limit: 8 }).map((m) => [m.id, m.pieceKey ?? null])) : {};
  const libraryHref = (extra: Record<string, string | null> = {}) => links.tab("library", { type, ...extra });
  const planTab = tab === "board" || tab === "queue";
  // Where the page stands (the table's kind filter, Queue view, focus and week; the Library's type),
  // so the pop-up and the forms return to it.
  const tableState: Record<string, string | null> =
    tab === "library"
      ? { type }
      : tab === "home"
        ? { kind, pieces: sp.pieces === "list" ? "list" : null, board: sp.board === "week" ? "week" : null }
        : { kind, by: tab === "queue" && queueView === "piece" ? "piece" : null, focus, week: week ?? null };
  const quickFor = (p: Piece) => Boolean(editHere && editHere.kinds.includes(p.kind));
  /** Edit, form to form: the pop-up on the site's quick form, or Studio when the site has none for the kind. */
  const editHrefOf = (p: Piece) => (quickFor(p) ? links.tab(tab, { ...tableState, piece: p.key, edit: "1" }) : links.studio({ kind: studioKindOf(p.kind), id: p.subject.id }));
  const rowLinks: RowLinks = {
    manageHref: (p) => links.tab(tab, { ...tableState, piece: p.key }),
    editHref: editHrefOf,
    makeIntoHref: (p, to) => links.makeInto(p.key, to),
    networkHref: (p) => links.network(`/channel/piece/${p.subject.kind}/${encodeURIComponent(p.subject.id)}?org=${ORG_Q}`),
  };
  const routinesHref = links.network(`/channel/routines?org=${ORG_Q}`);
  const popupTab = true; // the pop-up opens over every view (Studio's "Plan it" lands on Home)
  const selected = popupTab && pieceKey && model ? model.pieces.find((p) => p.key === pieceKey) ?? null : null;
  const sheetClose = links.tab(tab, tableState);
  // The side sheet is for a new one ("New ▾ → Artwork, here"); a piece opens in the pop-up.
  const side =
    sheet && editHere && !selected ? (
      <aside className="kch-card kch-sheet" aria-label={editHere.newLabel}>
        <Link className="kch-close" href={sheetClose}>
          Close
        </Link>
        {editHere.render({ id: sheetId, closeHref: sheetClose, studioHref: links.studio({ kind: editHere.studioKind, id: sheetId }) })}
      </aside>
    ) : null;
  // The manage-piece pop-up over the table: Edit opens the site's quick form in place when it has one for the kind.
  let popup: ReactNode = null;
  if (selected && model) {
    const here = { ...tableState, piece: selected.key };
    const closeEditHref = links.tab(tab, here);
    const quick = quickFor(selected);
    const studioKind = quick && editHere ? editHere.studioKind : null;
    const editing = Boolean(quick && sp.edit === "1");
    const moves: SiteMove[] = channelNextMoves(model, { pieceKey: selected.key, limit: 4 }).map((m) => ({
      id: m.id,
      kicker: m.kicker,
      title: m.title,
      reason: m.reason,
      run: m.run && SITE_NEXT_RUNS.includes(m.run.id) ? m.run : null,
      openHref: networkHref(m.href),
      openLabel: m.open?.kind === "studio" ? m.open.label : "Open in Channel",
    }));
    popup = (
      <PieceSummary
        piece={selected}
        model={model}
        links={links}
        moves={moves}
        planHref={links.tab(tab, { ...here, tab: "plan" })}
        planOpen={pieceView === "plan"}
        closeHref={links.tab(tab, tableState)}
        editHref={editHrefOf(selected)}
        editing={editing}
        closeEditHref={closeEditHref}
        edit={editing && editHere ? editHere.render({ id: selected.subject.id, closeHref: closeEditHref, studioHref: links.studio({ kind: studioKind, id: selected.subject.id }) }) : null}
      />
    );
  }

  const unread = <p className="kch-fine">The channel could not be read just now. Try again in a moment.</p>;
  const inChannel = new Set(model?.pieces.map((p) => p.key) ?? []);
  /** A library card opens the piece's pop-up when Channel knows it, else the piece in Studio. */
  const cardHref = (it: ContentListItem): { href: string; local: boolean } =>
    inChannel.has(it.key) ? { href: links.tab("library", { type, piece: it.key }), local: true } : { href: itemStudioUrl(it), local: false };

  return (
    <ChannelDoor run={run}>
      <div className={`kch${planTab || tab === "out" || tab === "home" ? " kch--wide" : ""}`}>
        <header className="kch-head">
          <h1 className="kch-title">Channel</h1>
          <div className="kch-actions">
            <details className="kch-menu kch-new">
              <summary className="kch-btn kch-btn--ghost">＋ New ▾</summary>
              <div className="kch-menu-list">
                {editHere ? <Link href={links.tab(tab === "home" || tab === "out" ? "library" : tab, { sheet: "edit" })}>{editHere.newLabel}</Link> : null}
                <a href={links.studio({ kind: "post" })}>Post ↗</a>
                <a href={links.studio({ kind: "meeting" })}>Meeting ↗</a>
                <a href={links.studio({ kind: "video" })}>Video ↗</a>
                <a href={links.studio({ kind: "writing" })}>Writing ↗</a>
              </div>
            </details>
            <a className="kch-btn kch-btn--ghost" href={links.studio()}>
              Open Studio ↗
            </a>
          </div>
        </header>

        <nav className="kch-tabs" aria-label="Channel">
          {TABS.map((t) => (
            <Link key={t.id} className="kch-tab" href={links.tab(t.id)} aria-current={t.id === tab ? "page" : undefined}>
              {t.label}
              {badge[t.id] ? <span className="kch-n">{badge[t.id]}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="kch-body">
          {tab === "home" ? (
            model ? (
              <ChannelHome
                model={model}
                links={links}
                moves={moves}
                movePieces={movePieces}
                kind={kind}
                piecesMode={sp.pieces === "list" ? "list" : "covers"}
                boardMode={sp.board === "week" ? "week" : "outlets"}
                rowLinks={rowLinks}
                routinesHref={routinesHref}
                orgQ={ORG_Q}
              />
            ) : (
              unread
            )
          ) : tab === "out" ? (
            model ? (
              <OutTab model={model} links={links} outlet={outlet} failedOnly={failedOnly} orgQ={ORG_Q} />
            ) : (
              unread
            )
          ) : tab === "queue" || tab === "board" ? (
            <div className={`kch-split${side ? " kch-split--sheet" : ""}`}>
              {!model ? (
                unread
              ) : tab === "queue" ? (
                <QueueTab model={model} links={links} kind={kind} view={queueView} focus={focus} rowLinks={rowLinks} routinesHref={routinesHref} />
              ) : (
                <BoardTab model={model} links={links} kind={kind} rowLinks={rowLinks} />
              )}
              {side}
            </div>
          ) : (
            <>
              <div className={`kch-split${side ? " kch-split--sheet" : ""}`}>
                <section>
                  <div className="kch-sec">
                    <h2>Library</h2>
                  </div>
                  {tab === "library" ? (
                    <div className="kch-filters kch-gap-top">
                      <Link className="kch-chip" href={links.tab("library", { sheet })} aria-current={type ? undefined : "true"}>
                        All
                      </Link>
                      {TYPE_FILTERS.map((t) => (
                        <Link key={t.id} className="kch-chip" href={links.tab("library", { type: t.id, sheet })} aria-current={type === t.id ? "true" : undefined}>
                          {t.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  <div className="kch-gap-top">
                    {!list ? (
                      <p className="kch-fine">The pieces could not be loaded just now.</p>
                    ) : list.items.length === 0 ? (
                      <p className="kch-fine">Nothing here yet.</p>
                    ) : (
                      <ul className="kch-cards">
                        {list.items.map((it) => {
                          const c = cardHref(it);
                          const body = (
                            <>
                              {it.cover ? <img className="kch-card-cover" src={it.cover} alt="" loading="lazy" /> : <span className="kch-card-band" data-type={it.type} aria-hidden="true" />}
                              <span className="kch-card-body">
                                <span className="kch-eb">{typeLabel(it.type)}</span>
                                <span className="kch-card-title">{it.title || "Untitled"}</span>
                                <span className="kch-fine">
                                  {it.status}
                                  {it.statusNote ? ` · ${it.statusNote}` : ""}
                                </span>
                              </span>
                            </>
                          );
                          return (
                            <li key={it.key}>
                              {c.local ? (
                                <Link className="kch-card-link" href={c.href} scroll={false}>
                                  {body}
                                </Link>
                              ) : (
                                <a className="kch-card-link" href={c.href}>
                                  {body}
                                </a>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {tab === "library" && list?.nextCursor ? (
                    <p className="kch-gap-top">
                      <Link className="kch-btn kch-btn--ghost kch-btn--sm" href={libraryHref({ cursor: list.nextCursor, sheet })}>
                        More
                      </Link>
                    </p>
                  ) : null}
                </section>
                {side}
              </div>
            </>
          )}
        </div>
        {popup}
      </div>
    </ChannelDoor>
  );
}
