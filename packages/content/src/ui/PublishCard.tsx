"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { SurfaceCard, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { fmtDay, type ContentIdentity, type ContentListItem } from "../model";
import type { CreateKindId, CreateKindMeta, StudioHandoff } from "../registry";
import { KindStrip } from "./KindStrip";
import { PieceLightbox, type PieceLightboxAction } from "./PieceLightbox";
import { PieceList } from "./PieceRow";
import type { ContentLinkComponent } from "./connectors";

// The Publish hub card, host-agnostic. Two parts, no next/*, no app actions:
// the collapsed face (PublishCardFace) and the pop-up body (PublishPopup).
// They are shaped for the `defineHubCard` contract
// (docs/open/NETWORK_SERVING_ARCHITECTURE_2026-11-08.md §4.2): `Face` and
// `Popup` draw from `PublishCardData`, which is what `load(site, viewer)`
// returns; the connectors say what each click does.

/** What the card's server `load` returns. */
export interface PublishCardData {
  counts: { drafts: number; scheduled: number };
  /** Everything the viewer may see, for "Open the full library (N)". */
  total: number;
  /** The soonest scheduled piece, for the face's one quiet line. */
  next?: { title: string; at: string } | null;
  /** Newest first. The pop-up draws the first `rows`. */
  recent: ContentListItem[];
  identities: ContentIdentity[];
  timeZone: string;
}

// ── collapsed face ─────────────────────────────────────────────────────────

export interface PublishCardFaceProps {
  counts: PublishCardData["counts"];
  next?: PublishCardData["next"];
  timeZone: string;
  /** Opens the pop-up; gets the face element so the pop-up can grow out of it (cms-ui SurfaceCard). */
  onOpen?: (origin: HTMLElement | null) => void;
  surface?: SurfaceDescriptor;
  href?: string;
  title?: string;
}

/** "Publish", with how many drafts and scheduled pieces are waiting. A cms-ui SurfaceCard, so it sits in any hub grid. */
export function PublishCardFace({ counts, next, timeZone, onOpen, surface, href, title = "Publish" }: PublishCardFaceProps) {
  const nothing = counts.drafts === 0 && counts.scheduled === 0;
  return (
    <SurfaceCard
      kind="post"
      glyph="◉"
      kicker={null}
      layout="header"
      title={title}
      blurb={nothing && !next ? "Write a post, set up a meeting, add an artwork." : undefined}
      surface={surface}
      href={href}
      onClick={onOpen}
      ariaLabel={`${title}: ${counts.drafts} drafts, ${counts.scheduled} scheduled`}
      cue="+"
      preview={
        <div className="eac-face-live eac-c eac-c-face">
          <dl className="eac-c-face-counts">
            <div>
              <dd data-zero={counts.drafts === 0 ? "1" : undefined}>{counts.drafts}</dd>
              <dt>{counts.drafts === 1 ? "Draft" : "Drafts"}</dt>
            </div>
            <div>
              <dd data-zero={counts.scheduled === 0 ? "1" : undefined}>{counts.scheduled}</dd>
              <dt>Scheduled</dt>
            </div>
          </dl>
          {next && (
            <p className="eac-c-face-next">
              Next: <strong>{next.title}</strong>, {fmtDay(next.at, timeZone)}
            </p>
          )}
        </div>
      }
    />
  );
}

// ── pop-up body ────────────────────────────────────────────────────────────

export interface PublishPopupProps extends Omit<PublishCardData, "counts" | "next"> {
  /** How many recent rows to draw. Default 6. */
  rows?: number;
  /** Whose pieces: "all", or an identity id. Controlled by the host when it refetches per scope; local otherwise. */
  scope?: string;
  onScopeChange?: (scope: string) => void;
  /** The kind tiles: the default hand-off links to the Studio (focus mode); give `kindHref` or `onPickKind` to change that. */
  studio?: StudioHandoff;
  kindHref?: (kind: CreateKindMeta) => string | null;
  onPickKind?: (kind: CreateKindMeta, el: HTMLElement) => void;
  ready?: Partial<Record<CreateKindId, boolean>>;
  /** Library search beyond the recent rows (the host's query); without it the recent rows are filtered in place. */
  search?: (q: string) => Promise<ContentListItem[]>;
  /** The lightbox's lead button: Manage this piece (the piece view). */
  primaryAction: (item: ContentListItem) => PieceLightboxAction | null;
  /** Where "Open the full library" goes. Default /content. */
  libraryHref?: string;
  Link?: ContentLinkComponent;
  className?: string;
}

/**
 * The Publish pop-up. Top: the kind tiles (a hand-off to the Studio, no form
 * here). Below: a library search, then the recent pieces for the person or
 * the org as small rows. A row opens the same lightbox Channel uses, whose
 * "Manage this piece" opens the piece view and "Open in Studio" hands off.
 */
export function PublishPopup({
  recent,
  total,
  identities,
  timeZone,
  rows = 6,
  scope: scopeProp,
  onScopeChange,
  studio,
  kindHref,
  onPickKind,
  ready,
  search,
  primaryAction,
  libraryHref = "/content",
  Link,
  className,
}: PublishPopupProps) {
  const [scopeLocal, setScopeLocal] = React.useState("all");
  const scope = scopeProp ?? scopeLocal;
  const [q, setQ] = React.useState("");
  const [found, setFound] = React.useState<ContentListItem[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const opener = React.useRef<HTMLElement | null>(null);

  const orgOf = (id: string) => (id.startsWith("org:") ? id.slice(4) : null);
  const handoff: StudioHandoff = { ...studio, org: studio?.org ?? (scope !== "all" ? orgOf(scope) : null) };

  const inScope = (p: ContentListItem) => scope === "all" || p.siteIdentityId === scope || p.ownerIdentityId === scope;
  const needle = q.trim().toLowerCase();

  React.useEffect(() => {
    if (!search || !needle) {
      setFound(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      search(q.trim()).then((r) => live && setFound(r), () => live && setFound([]));
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, needle, search]);

  const base = found ?? recent;
  const list = base.filter((p) => inScope(p) && (!needle || found || `${p.title} ${p.meta} ${p.siteName}`.toLowerCase().includes(needle))).slice(0, rows);
  const everything = [...recent, ...(found ?? [])];
  const openItem = open ? everything.find((p) => p.key === open) : undefined;
  const brandNew = recent.length === 0 && !needle;

  const close = () => {
    setOpen(null);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const scopeName = scope === "all" ? "all yours" : (identities.find((i) => i.id === scope)?.shortName ?? "");
  const Lib = Link;

  return (
    <div className={`eac-c eac-c-pub${className ? ` ${className}` : ""}`}>
      <div className="eac-c-pub-content" inert={openItem ? true : undefined}>
        <KindStrip variant="tiles" studio={handoff} href={kindHref} onPick={onPickKind} ready={ready} lead={brandNew ? "post" : undefined} />

        {brandNew ? (
          <div className="eac-c-pub-empty">
            <h3>Publish your first post</h3>
            <p>Pick Post above. It opens the Studio as a blank page, ready to type into. Everything you publish shows up here afterwards.</p>
          </div>
        ) : (
          <>
            <form className="eac-c-pub-search" role="search" onSubmit={(e) => e.preventDefault()}>
              <label className="chn-search">
                <Search size={15} aria-hidden />
                <span className="chn-sr">Search the library</span>
                <input type="search" placeholder="Search the library" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              {identities.length > 1 && (
                <div className="chn-seg" role="group" aria-label="Whose pieces">
                  <button type="button" aria-pressed={scope === "all"} onClick={() => (onScopeChange ? onScopeChange("all") : setScopeLocal("all"))}>
                    All yours
                  </button>
                  {identities.map((i) => (
                    <button key={i.id} type="button" aria-pressed={scope === i.id} onClick={() => (onScopeChange ? onScopeChange(i.id) : setScopeLocal(i.id))}>
                      {i.kind === "user" ? "You" : i.shortName}
                    </button>
                  ))}
                </div>
              )}
            </form>
            <div>
              <div className="eac-c-pub-head">
                <h3 className="chn-kicker">{needle ? "Results" : `Recent · ${scopeName}`}</h3>
              </div>
              {list.length === 0 ? (
                <p className="eac-c-lib-empty">{needle ? `Nothing matches “${q}”.` : "Nothing here yet for this scope."}</p>
              ) : (
                <PieceList
                  items={list}
                  timeZone={timeZone}
                  onOpen={(it, el) => {
                    opener.current = el;
                    setOpen(it.key);
                  }}
                />
              )}
            </div>
            <div className="eac-c-pub-foot">
              {Lib ? (
                <Lib className="chn-link" href={libraryHref}>
                  Open the full library ({total})
                </Lib>
              ) : (
                <a className="chn-link" href={libraryHref}>
                  Open the full library ({total})
                </a>
              )}
            </div>
          </>
        )}
      </div>
      {openItem && <PieceLightbox item={openItem} timeZone={timeZone} onClose={close} primary={primaryAction(openItem)} />}
    </div>
  );
}
