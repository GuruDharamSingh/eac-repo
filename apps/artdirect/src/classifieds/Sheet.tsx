"use client";

import type { CSSProperties, ReactNode } from "react";
import { styleVars } from "./style";
import { type Tile, type Unit } from "./plane";

/**
 * One tile of the continuous section as DOM: absolutely positioned boxes on
 * the shared paper, with each band's column rules behind them. Everything
 * is real text in real fonts at zoom 1; the viewer scales the whole world
 * with a transform, so type re-rasterises sharp at every zoom.
 *
 * A box's voice (template faces, scales, fill, ink, edge) is set as `--u-*`
 * properties and `cl-b-*` / `cl-t-*` classes on the box; heads carry their
 * device as `cl-h-<device>`. The tile's theme sits on the tile as `--cl-*`
 * and the unit rules fall back to it.
 */
export function TileView({ tile, onPick }: { tile: Tile; onPick?: (u: Unit, t: Tile) => void }) {
  const s = tile.style;
  const g = tile.grid;
  const style: CSSProperties = {
    ...(styleVars(s) as CSSProperties),
    left: tile.x,
    top: tile.y,
    width: tile.w,
    height: tile.h,
    backgroundImage:
      s.rule >= 0.35
        ? `repeating-linear-gradient(to right, transparent 0, transparent ${(g.colW + g.gap / 2 - s.rule / 2).toFixed(2)}px, var(--cl-ink) ${(g.colW + g.gap / 2 - s.rule / 2).toFixed(2)}px, var(--cl-ink) ${(g.colW + g.gap / 2 + s.rule / 2).toFixed(2)}px, transparent ${(g.colW + g.gap / 2 + s.rule / 2).toFixed(2)}px, transparent ${(g.colW + g.gap).toFixed(2)}px)`
        : undefined,
  };
  return (
    <div className="cl-tile cl-zone" style={style} data-zone={`${tile.zone.r},${tile.zone.k}`} data-mix={s.anchors.mix.id} data-palette={s.palette.id}>
      {tile.units.map((u) => (
        <UnitView key={u.key} unit={u} onPick={onPick ? () => onPick(u, tile) : undefined} />
      ))}
    </div>
  );
}

function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((p, k) => (
        <span key={k} className="cl-line">{p}</span>
      ))}
    </>
  );
}

/** Classes and custom properties a unit's voice resolves to. Shared with the focus view. */
export function voiceStyle(u: Unit): { cls: string; vars: CSSProperties } {
  const v = u.voice;
  const vars = {
    "--u-body": v.fontBody,
    "--u-head": v.fontHead,
    "--u-display": v.fontDisplay,
    "--u-head-scale": String(v.headScale),
    "--u-body-scale": String(v.bodyScale),
    "--u-fill": v.fill ?? "transparent",
    "--u-ink": v.ink ?? "var(--cl-ink)",
    "--u-edge": v.edge ?? "var(--cl-ink)",
    textAlign: v.align,
  } as CSSProperties;
  const cls = [
    "cl-u",
    `cl-u-${u.kind}`,
    `cl-b-${v.border}`,
    v.cls ?? "",
    v.fill ? "cl-filled" : "",
    v.reverse ? "cl-reversed" : "",
    v.shadow ? "cl-shadowed" : "",
    u.head ? `cl-h-${u.head.device}` : "",
    u.home ? "cl-home" : "",
    u.ad.origin === "real" ? "cl-real" : "",
  ].filter(Boolean).join(" ");
  return { cls, vars };
}

/**
 * A story's picture, screened like a wire photo on newsprint. It sits over the
 * cut's halftone placeholder, so a picture that fails to load leaves the cut.
 */
function Photo({ src, wide }: { src: string; wide?: boolean }) {
  return (
    <span className={wide ? "cl-cut cl-photo cl-photo-wide" : "cl-cut cl-photo"} aria-hidden="true">
      <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; }} />
    </span>
  );
}

/** The inside of a box, by kind. Shared by the tile and the focus view. */
export function UnitBody({ unit: u }: { unit: Unit }) {
  const a = u.ad;
  const foot = a.foot ? <span className="cl-foot">{a.foot}</span> : null;
  switch (u.kind) {
    case "head":
      return (
        <>
          {u.head?.device === "two-tier" && u.num ? <small className="cl-head-kicker">{u.num}</small> : null}
          <span className="cl-head-label">{u.label}</span>
          {u.num && u.head?.device !== "two-tier" ? <span className="cl-head-num">{u.num}</span> : null}
        </>
      );
    case "banner":
      return (
        <>
          {a.lead ? <div className="cl-banner-kicker">{a.lead}</div> : null}
          <div className="cl-banner-title">{a.headline}</div>
          <div className="cl-banner-rule" />
        </>
      );
    case "filler":
      return <span className="cl-code">{a.body}</span>;
    case "liner":
    case "liner-tint":
      return <p><b className="cl-lead">{a.lead}</b> {a.body} {foot}</p>;
    case "boxed":
      return <p><b className="cl-lead cl-lead-line">{a.lead}</b>{a.body} {foot}</p>;
    case "display":
    case "reverse":
      return (
        <>
          <div className="cl-display-head">{a.headline ?? a.lead}</div>
          {a.image ? <Photo src={a.image} wide /> : null}
          <p>{a.body}</p>
          {foot ? <div className="cl-display-foot">{a.foot}</div> : null}
        </>
      );
    case "notice":
      return (
        <>
          <div className="cl-notice-head">{a.headline ?? a.lead}</div>
          <p>{a.body}</p>
          {foot ? <div className="cl-notice-sign">{a.foot}</div> : null}
        </>
      );
    case "stack":
      return (
        <>
          <div className="cl-stack-1">{a.headline ?? a.lead}</div>
          <div className="cl-stack-2">{a.body.split(".")[0]}.</div>
          <div className="cl-stack-3">{a.body.split(".").slice(1).join(".").trim()}</div>
          {foot ? <div className="cl-stack-4">{a.foot}</div> : null}
        </>
      );
    case "coupon":
      return (
        <>
          <span className="cl-scissors" aria-hidden="true">✂</span>
          <div className="cl-coupon-head">YES! SEND ME THE <em>{a.headline ?? a.lead}</em></div>
          <p>{a.body}</p>
          <div className="cl-coupon-line">NAME</div>
          <div className="cl-coupon-line">ADDRESS</div>
          <div className="cl-coupon-line">CITY</div>
          <div className="cl-display-foot">Mail to {a.foot ?? "Dept. B-12"}, c/o ArtDirect</div>
        </>
      );
    case "offer":
      return (
        <>
          <div className="cl-offer-head">{a.headline ?? a.lead}</div>
          <p>{a.body}</p>
          <span className="cl-price">{a.price ?? "FREE"}</span>
        </>
      );
    case "agency":
    case "listing":
      return (
        <>
          <div className="cl-listing-head">{a.headline ?? a.lead}</div>
          <p className="cl-listing-lines"><Lines text={a.body} /></p>
          {foot ? <div className="cl-display-foot">{a.foot}</div> : null}
        </>
      );
    case "poster":
      return (
        <>
          <div className="cl-poster-when">{a.lead}</div>
          <div className="cl-poster-title">{a.headline}</div>
          <div className="cl-poster-sub">{a.body}</div>
          <div className="cl-poster-venue">{a.foot}</div>
        </>
      );
    case "personal":
      return (
        <>
          <div className="cl-personal-name">{a.headline ?? a.lead}</div>
          <p>{a.body}</p>
          <div className="cl-personal-sign">{a.foot}</div>
        </>
      );
    case "card":
      return (
        <>
          <div className="cl-card-name">{a.headline ?? a.lead}</div>
          <p>{a.body}</p>
          <div className="cl-card-foot">{a.foot}</div>
        </>
      );
    case "profile":
      return (
        <>
          {a.image ? <Photo src={a.image} /> : <span className="cl-cut" aria-hidden="true" />}
          <p><b className="cl-lead">{a.lead}</b> {a.body} {foot}</p>
        </>
      );
    case "house":
      return (
        <>
          <div className="cl-house-head">{a.headline ?? a.lead}</div>
          <p>{a.body}</p>
        </>
      );
    case "article":
      return (
        <>
          <div className="cl-article-head">{a.headline}</div>
          {a.image ? <Photo src={a.image} wide /> : null}
          <div className="cl-article-deck">{a.lead}</div>
          <p className="cl-article-body">{a.body}</p>
          {foot ? <div className="cl-article-by">{a.foot}</div> : null}
        </>
      );
    case "weather":
      return (
        <>
          <div className="cl-weather-head">{a.headline ?? a.lead}</div>
          <table className="cl-weather">
            <tbody>
              {a.body.split("\n").map((row, k) => (
                <tr key={k}>{row.split("\t").map((cell, c) => <td key={c}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
          {foot ? <div className="cl-weather-foot">{a.foot}</div> : null}
        </>
      );
  }
}

function UnitView({ unit: u, onPick }: { unit: Unit; onPick?: () => void }) {
  const { cls, vars } = voiceStyle(u);
  const style = { ...vars, left: u.x, top: u.y, width: u.w, height: u.h } as CSSProperties;
  const pickable = !!onPick && u.kind !== "head" && u.kind !== "filler" && u.kind !== "banner";
  return (
    <div className={cls} style={style} data-type={u.ad.type} data-origin={u.ad.origin} onClick={pickable ? onPick : undefined} role={pickable ? "button" : undefined} tabIndex={pickable ? 0 : undefined}>
      <UnitBody unit={u} />
    </div>
  );
}

/** A box enlarged on its own, same voice, no clipping: the focus view's centrepiece. */
export function UnitLarge({ unit: u, width, children }: { unit: Unit; width: number; children?: ReactNode }) {
  const { cls, vars } = voiceStyle(u);
  return (
    <div className={`${cls} cl-large`} style={{ ...vars, width } as CSSProperties}>
      <UnitBody unit={u} />
      {children}
    </div>
  );
}
