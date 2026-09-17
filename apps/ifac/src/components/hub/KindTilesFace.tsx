"use client";

import { SurfaceCard, useSurface, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";

// ============================================================================
// A face whose body is a row of tiles, one per kind.
//
// Where a tile goes is a per-kind decision, not a policy, and both answers are
// right for different kinds:
//
//   POPUP  for something short. A post, a meeting — a title, a few lines, a
//          date. The hub stays where it is and the surface stacks.
//   PAGE   for something long. The writing room, an event with a schedule
//          block and a cover, a workshop with sessions. A modal's backdrop is
//          one stray click from discarding twenty minutes of typing, which is
//          why compose was a route to begin with.
//
// Clicking the CARD rather than a tile opens the catalogue popup — the same
// list, for someone who has not decided yet.
//
// A tile with neither `href` nor `surface` is declared-but-unbuilt, and is
// drawn saying so. That is deliberate: the set of things you can publish is
// easier to understand whole, and a gap you can see is better than a door
// that opens onto nothing.
// ============================================================================

export interface KindTile {
  /**
   * `threads.kind` — the accent the tile takes, NOT its identity. Two tiles
   * can share one: "Post" and "Writing room" both write `post`, they are two
   * doors onto the same row. Tiles are keyed by label for that reason.
   */
  kind: string;
  glyph: string;
  label: string;
  /** One short line under the label. */
  note?: string;
  /** Opens a page. */
  href?: string;
  /** Opens a popup. Wins over `href` if both are given. */
  surface?: SurfaceDescriptor;
}

export function KindTilesFace({
  title,
  blurb,
  kind = "compose",
  tiles,
  cardSurface,
  ariaLabel,
}: {
  title: string;
  /** Omit for a card whose tiles say everything. */
  blurb?: string;
  kind?: string;
  tiles: KindTile[];
  /** What clicking the card itself opens. */
  cardSurface?: SurfaceDescriptor;
  ariaLabel?: string;
}) {
  const surfaces = useSurface();

  return (
    <SurfaceCard
      kind={kind}
      layout="header"
      kicker={null}
      title={title}
      blurb={blurb}
      ariaLabel={ariaLabel ?? title}
      onClick={
        cardSurface ? (origin) => surfaces.open(cardSurface, origin) : undefined
      }
      preview={
        <div className="eac-face-live ifac-kinds">
          {tiles.map((tile) => {
            const body = (
              <>
                <span className="ifac-kind-glyph" aria-hidden>
                  {tile.glyph}
                </span>
                <span className="ifac-kind-label">{tile.label}</span>
                {tile.note && <span className="ifac-kind-note">{tile.note}</span>}
              </>
            );

            if (tile.surface) {
              return (
                <button
                  key={tile.label}
                  type="button"
                  className="ifac-kind"
                  data-kind={tile.kind}
                  onClick={(e) => {
                    // Stop the face's own hit-area behind this from ALSO
                    // opening the catalogue.
                    e.stopPropagation();
                    surfaces.open(
                      tile.surface!,
                      e.currentTarget.closest<HTMLElement>(".eac-face")
                    );
                  }}
                >
                  {body}
                </button>
              );
            }

            if (tile.href) {
              return (
                <a
                  key={tile.label}
                  className="ifac-kind"
                  href={tile.href}
                  data-kind={tile.kind}
                  onClick={(e) => e.stopPropagation()}
                >
                  {body}
                </a>
              );
            }

            return (
              <span
                key={tile.label}
                className="ifac-kind is-soon"
                data-kind={tile.kind}
                aria-disabled="true"
              >
                <span className="ifac-kind-glyph" aria-hidden>
                  {tile.glyph}
                </span>
                <span className="ifac-kind-label">{tile.label}</span>
                <span className="ifac-kind-note">{tile.note ?? "Not built yet"}</span>
              </span>
            );
          })}
        </div>
      }
    />
  );
}
