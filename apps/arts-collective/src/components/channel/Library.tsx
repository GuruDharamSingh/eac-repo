"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { PieceLightbox } from "@elkdonis/content/ui";
import { SurfaceFrame } from "@elkdonis/cms-ui/surface";
import { PIECE_KINDS, fmtDay, kindGlyph, type Piece, type PieceKind } from "@/lib/channel/model";
import { channelPieceToListItem } from "@/lib/channel/content-list";
import { useChannel } from "./context";
import { IdentityMark } from "./icons";
import { KindLine, OutletMarks } from "./bits";

const FORUM = (process.env.NEXT_PUBLIC_FORUM_URL ?? "https://forum.arts-collective.com").replace(/\/$/, "");

/**
 * Content library (3b): the Content tab of network search, scoped to the
 * sites this person belongs to and grouped by site. Bricks with a lightbox
 * (owner request), not the list in the mock. Picking a piece replaces the
 * piece pop-up beneath with that piece's pop-up.
 *
 * Only the sites already loaded for this channel are searched: there is no
 * network-wide content search on this host yet, so "Whole network" is left
 * out rather than offered and refused.
 */
export function LibrarySurface({ fromKey, onPick }: { fromKey: string | null; onPick?: (key: string) => void }) {
  const { model, identity, openPiece, piece: find, surface } = useChannel();
  const pick = (key: string) => {
    onPick?.(key);
    surface.pop();
  };
  const startKind = fromKey?.startsWith("kind:") ? (fromKey.slice(5) as PieceKind) : null;
  const current = fromKey && !fromKey.startsWith("kind:") ? fromKey : null;
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState<PieceKind | "all">(startKind ?? "all");
  const [scope, setScope] = React.useState<string>("all");
  const [open, setOpen] = React.useState<string | null>(null);
  const opener = React.useRef<HTMLButtonElement | null>(null);
  const close = () => {
    setOpen(null);
    // Back to the brick that opened it.
    requestAnimationFrame(() => opener.current?.focus());
  };

  const kinds = PIECE_KINDS.filter((k) => model.pieces.some((p) => p.kind === k.id || (k.id === "series" && p.kind === "workshop") || (k.id === "meeting" && p.kind === "event")));
  const matchKind = (p: Piece) =>
    kind === "all" || p.kind === kind || (kind === "series" && p.kind === "workshop") || (kind === "meeting" && p.kind === "event") || (kind === "artwork" && p.kind === "product");
  const needle = q.trim().toLowerCase();
  const shown = model.pieces.filter(
    (p) => matchKind(p) && (scope === "all" || p.siteIdentityId === scope || p.ownerIdentityId === scope) && (!needle || `${p.title} ${p.excerpt} ${p.meta}`.toLowerCase().includes(needle))
  );

  const groups = new Map<string, { title: string; host: string | null; identityId: string; pieces: Piece[] }>();
  for (const p of shown) {
    const k = `${p.siteIdentityId}|${p.siteName}`;
    if (!groups.has(k)) groups.set(k, { title: p.siteName, host: p.siteHost, identityId: p.siteIdentityId, pieces: [] });
    groups.get(k)!.pieces.push(p);
  }
  const openPieceObj = open ? find(open) : undefined;

  return (
    <SurfaceFrame
      kind="gallery"
      kicker={onPick ? "Content library" : "Network search"}
      title={onPick ? "Choose a piece" : "Content library"}
      flush
      status={`${shown.length} ${shown.length === 1 ? "result" : "results"} across ${groups.size} ${groups.size === 1 ? "site" : "sites"} · only sites you belong to`}
    >
      <div
        className="chn-lib"
        onKeyDown={(e) => {
          // Escape closes the preview first; the surface's own Escape (back a layer) only when none is open.
          if (open && e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >
        <div className="chn-lib-content" inert={openPieceObj ? true : undefined}>
        <div className="chn-lib-bar">
          <label className="chn-search">
            <Search size={15} aria-hidden />
            <span className="chn-sr">Search</span>
            <input type="search" placeholder="Search your sites" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="chn-seg" role="group" aria-label="Scope">
            <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
              All yours
            </button>
            {model.identities.map((i) => (
              <button key={i.id} type="button" aria-pressed={scope === i.id} onClick={() => setScope(i.id)}>
                {i.kind === "user" ? "You" : i.shortName}
              </button>
            ))}
          </div>
        </div>
        <div className="chn-lib-bar">
          <nav className="chn-tabs is-inline" aria-label="Network search">
            <span aria-current="page">Content</span>
            <a href="/artists">People</a>
            <a href="/directory">Sites</a>
            <a href={FORUM}>Forum</a>
          </nav>
          <div className="chn-seg is-small" role="group" aria-label="Kind">
            <button type="button" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
              All
            </button>
            {kinds
              .filter((k) => k.id !== "workshop" && k.id !== "event")
              .map((k) => (
                <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </button>
              ))}
          </div>
        </div>

        {groups.size === 0 ? (
          <p className="chn-empty-line">{needle ? `Nothing matches “${q}”.` : "Nothing here yet."}</p>
        ) : (
          [...groups.values()].map((g) => {
            const idn = identity(g.identityId);
            return (
              <section key={`${g.identityId}|${g.title}`} className="chn-lib-group">
                <h3>
                  {idn ? <IdentityMark initials={idn.initials} kind={idn.kind} size={18} /> : null}
                  <strong>{g.title}</strong>
                  {g.host && <small>{g.host}</small>}
                </h3>
                <ul className="chn-bricks">
                  {g.pieces.map((p) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        className="chn-brick"
                        onClick={(e) => {
                          opener.current = e.currentTarget;
                          setOpen(p.key);
                        }}
                        aria-haspopup="dialog"
                      >
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" loading="lazy" />
                        ) : (
                          <span className="chn-brick-blank" data-kind={p.kind} aria-hidden>
                            {kindGlyph(p.kind)}
                          </span>
                        )}
                        <span className="chn-brick-body">
                          <strong>
                            {p.title} {p.key === current && <span className="chn-tag is-now">Open now</span>}
                          </strong>
                          <KindLine piece={p} />
                          <OutletMarks piece={p} />
                          <small data-motion={p.inMotion ? "1" : "0"}>{p.inMotion ? `In motion · ${p.inMotion.reason}` : quietLine(p, model.timeZone)}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        </div>
        {openPieceObj && (
          // A preview inside the surface: the bricks behind it are inert while it is open.
          // The lightbox itself lives in @elkdonis/content/ui (same markup, same classes).
          <PieceLightbox
            item={channelPieceToListItem(openPieceObj, model.timeZone)}
            timeZone={model.timeZone}
            onClose={close}
            primary={onPick ? { label: "Use this piece", onClick: () => pick(openPieceObj.key) } : { label: "Manage this piece", onClick: () => openPiece(openPieceObj.key) }}
          />
        )}
      </div>
    </SurfaceFrame>
  );
}

function quietLine(p: Piece, tz: string): string {
  const last = p.timeline[p.timeline.length - 1];
  if (p.status === "draft") return "Draft";
  if (!last) return "Not out yet";
  return `Quiet since ${fmtDay(last.at, tz)}`;
}
