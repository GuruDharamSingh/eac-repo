"use client";

import * as React from "react";
import { CREATE_KINDS, studioNewHref, typeMeta, type CreateKindId, type CreateKindMeta, type StudioHandoff } from "../registry";

export type KindStripVariant = "icons" | "words" | "tiles";

export interface KindStripProps {
  /** icons: square marks, the word is the tooltip. words: a glyph and one word. tiles: glyph, word and a hint (the "New" strip). */
  variant?: KindStripVariant;
  /** Kinds in the main row. Default: the primary kinds (Post, Meeting, Series, Artwork). */
  kinds?: CreateKindId[];
  /** Kinds in the quieter "more" row. Default Questionnaire and Poll; `false` drops the row. */
  more?: CreateKindId[] | false;
  /** Whether the Studio has a form for each kind. Default: the registry's flags. */
  ready?: Partial<Record<CreateKindId, boolean>>;
  /** Where a tile goes. Wins over the default hand-off; return null to make a tile inert. */
  href?: (kind: CreateKindMeta) => string | null;
  /** The default hand-off to the Studio (`/studio?kind=…&org=…&focus=1`), used when `href` is not given and no `onPick` is. */
  studio?: StudioHandoff;
  /** Called on click. With an href the click still navigates unless this calls preventDefault. */
  onPick?: (kind: CreateKindMeta, el: HTMLElement) => void;
  /** Draw this kind as the lead (the empty state points at Post). */
  lead?: CreateKindId;
  /** Accessible name of the group. */
  label?: string;
  className?: string;
}

/**
 * The kind strip: one tile per thing you can make. It does not open a form;
 * it hands off (a link, or `onPick`). Sized by its container, so the same
 * tiles work full-bleed on /content and compact in a pop-up.
 */
export function KindStrip({
  variant = "tiles",
  kinds,
  more,
  ready,
  href,
  studio,
  onPick,
  lead,
  label = "Make something new",
  className,
}: KindStripProps) {
  const main = (kinds ?? CREATE_KINDS.filter((k) => k.row === "primary").map((k) => k.id)).map((id) => CREATE_KINDS.find((k) => k.id === id)!).filter(Boolean);
  const rest = more === false ? [] : (more ?? CREATE_KINDS.filter((k) => k.row === "more").map((k) => k.id)).map((id) => CREATE_KINDS.find((k) => k.id === id)!).filter(Boolean);

  const one = (k: CreateKindMeta) => {
    const isReady = ready?.[k.id] ?? k.studio.ready;
    const target = href ? href(k) : onPick ? null : studioNewHref(k.id, studio);
    const live = isReady && (target || onPick);
    const cls = `eac-c-kind${lead === k.id ? " is-lead" : ""}${live ? "" : " is-soon"}`;
    const body = (
      <>
        <span className="eac-c-kind-glyph" aria-hidden>
          {k.glyph}
        </span>
        {variant === "icons" ? <span className="eac-c-kind-sr">{k.label}</span> : <span className="eac-c-kind-label">{k.label}</span>}
        {variant === "tiles" && <span className="eac-c-kind-hint">{k.hint}</span>}
        {!live && variant !== "icons" && <span className="eac-c-kind-soon">Soon</span>}
      </>
    );
    if (!live) {
      return (
        <span key={k.id} className={cls} data-kind={typeMeta(k.type).surfaceKind} aria-disabled="true" title={`${k.label}: not in the Studio yet`}>
          {body}
        </span>
      );
    }
    const common = { className: cls, "data-kind": typeMeta(k.type).surfaceKind, title: variant === "icons" ? k.label : undefined };
    return target ? (
      <a key={k.id} {...common} href={target} onClick={(e) => onPick?.(k, e.currentTarget)}>
        {body}
      </a>
    ) : (
      <button key={k.id} type="button" {...common} onClick={(e) => onPick?.(k, e.currentTarget)}>
        {body}
      </button>
    );
  };

  return (
    <div className={`eac-c eac-c-kinds${className ? ` ${className}` : ""}`} data-variant={variant} role="group" aria-label={label}>
      <div className="eac-c-kinds-row">{main.map(one)}</div>
      {rest.length > 0 && (
        <div className="eac-c-kinds-more">
          {variant !== "icons" && <span className="eac-c-kinds-morelabel">More</span>}
          {rest.map(one)}
        </div>
      )}
    </div>
  );
}
