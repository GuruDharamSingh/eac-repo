"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { MapPin, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { hexToHslTriplet } from "@/lib/color";
import { displayTier } from "@/lib/rubric";
import type { Card, Tier } from "@/lib/types";

interface PigeonCardProps {
  card: Card;
  tiers: Tier[];
  /** Full card with flip and story; `compact` is the grid tile. */
  variant?: "full" | "compact";
  /** Wrap in a link to the card page. Off on the detail page itself. */
  href?: string;
}

/**
 * The trading card.
 *
 * Rarity is entirely data-driven: the tier's accent arrives as an inline
 * `--tier` custom property and its `frame_style` picks one of four treatments.
 * Adding a rarity band is a row in pigeon_tiers.
 *
 * The one thing this component is opinionated about is honesty. An unrated
 * card shows the machine's provisional guess in OUTLINE, labelled
 * "provisional" — it must never be mistakable for the owner's verdict, because
 * the owner's judgement is the actual product here.
 */
export function PigeonCard({ card, tiers, variant = "full", href }: PigeonCardProps) {
  const [flipped, setFlipped] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const { tier, provisional } = displayTier(tiers, card);
  const triplet = hexToHslTriplet(tier?.accentHex ?? null);
  const frameStyle = tier?.frameStyle ?? "plain";

  const front = card.images.find((i) => i.role === "front") ?? card.images[0] ?? null;
  const side = card.images.find((i) => i.role === "side") ?? null;

  const style = triplet ? ({ "--tier": triplet } as CSSProperties) : undefined;

  // Pointer-tracked sheen for holo cards. Writing CSS variables directly on the
  // node keeps this off React's render path — a state update per mousemove
  // would re-render the whole card sixty times a second.
  const trackPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (frameStyle !== "holo" || !frameRef.current) return;
    const r = frameRef.current.getBoundingClientRect();
    frameRef.current.style.setProperty("--mx", String(((e.clientX - r.left) / r.width) * 100));
    frameRef.current.style.setProperty("--my", String(((e.clientY - r.top) / r.height) * 100));
  };

  const face = (
    <div
      ref={frameRef}
      onPointerMove={trackPointer}
      className={cn(
        "ps-frame relative",
        frameStyle === "metal" && "ps-frame--metal",
        frameStyle === "foil" && "ps-frame--foil",
        frameStyle === "holo" && "ps-frame--holo"
      )}
    >
      <div className="relative overflow-hidden rounded-[0.8rem] bg-card">
        <div className="relative aspect-[3/4] bg-muted">
          {front ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={front.cardUrl ?? front.url}
              alt={front.altText ?? card.title}
              width={front.cardWidth ?? undefined}
              height={front.cardHeight ?? undefined}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              No photo
            </div>
          )}

          {frameStyle === "holo" && <span className="ps-holo-sheen" aria-hidden />}

          {/* Rarity badge. Outline + label when the machine guessed it. */}
          {tier && (
            <span
              className={cn(
                "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm",
                provisional
                  ? "border border-white/70 bg-black/25 text-white"
                  : "bg-[var(--tier-c)] text-white shadow-sm"
              )}
              title={
                provisional
                  ? `Provisional — scored ${card.autoScore}/${card.autoMax} by the site, not yet rated`
                  : `Rated ${tier.label}`
              }
            >
              {tier.label}
              {provisional && <span className="ml-1 opacity-80">?</span>}
            </span>
          )}

          {/* The second-angle tell. A dashed placeholder when it's missing is
              a deliberate nudge: incompleteness should be visible. */}
          {variant === "full" && (
            <div className="absolute bottom-2 left-2">
              {side ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setFlipped((v) => !v);
                  }}
                  className="size-14 overflow-hidden rounded-full border-2 border-white/90 shadow-md transition-transform hover:scale-105"
                  aria-label="Flip to the side profile"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={side.cardUrl ?? side.url}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </button>
              ) : (
                <span
                  className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-white/70 bg-black/25 text-center text-[9px] leading-tight text-white/90"
                  title="This card has no side profile"
                >
                  no
                  <br />
                  profile
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nameplate */}
        <div className="space-y-1 p-3">
          <p className="truncate font-display text-sm font-semibold leading-tight">
            {card.title}
          </p>
          <div className="flex items-center justify-between gap-2">
            {card.species ? (
              <span
                className="truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--tier-c) 18%, transparent)",
                  color: "color-mix(in srgb, var(--tier-c) 75%, black)",
                }}
              >
                {card.species.name}
              </span>
            ) : card.proposedSpeciesName ? (
              <span className="truncate text-[11px] italic text-muted-foreground">
                {card.proposedSpeciesName}?
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Unidentified</span>
            )}

            {(card.areaName || card.cityName) && (
              <span className="flex shrink-0 items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <MapPin className="size-3" />
                <span className="max-w-[9rem] truncate">{card.areaName ?? card.cityName}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const back = (
    <div
      className={cn(
        "ps-frame",
        frameStyle === "metal" && "ps-frame--metal",
        frameStyle === "foil" && "ps-frame--foil",
        frameStyle === "holo" && "ps-frame--holo"
      )}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[0.8rem] bg-card">
        <div className="relative aspect-[3/4] bg-muted">
          {side && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={side.cardUrl ?? side.url}
              alt="Side profile"
              className="size-full object-cover"
              loading="lazy"
            />
          )}
          <button
            type="button"
            onClick={() => setFlipped(false)}
            className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm"
          >
            <RotateCcw className="size-3" /> Back
          </button>
        </div>
        <div className="space-y-1 p-3 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Side profile</p>
          {card.lat != null && card.lng != null && (
            <p className="font-mono">
              {card.lat.toFixed(4)}, {card.lng.toFixed(4)}
              {card.geoPrecision === "block" && " (approx.)"}
            </p>
          )}
          {card.spottedAt && <p>Spotted {new Date(card.spottedAt).toLocaleDateString()}</p>}
          <p>
            {provisional ? "Provisional " : ""}
            {card.autoScore}/{card.autoMax} points
          </p>
        </div>
      </div>
    </div>
  );

  // Only a full card that actually has a side shot gets the 3D flipper —
  // there is nothing to flip to otherwise.
  const flippable = variant === "full" && Boolean(side);

  const wrapped = (
    <div className="ps-card" data-flipped={flippable && flipped} style={style}>
      {flippable ? (
        <div className="ps-card__flipper">
          <div className="ps-card__face">{face}</div>
          <div className="ps-card__face ps-card__face--back">{back}</div>
        </div>
      ) : (
        face
      )}
    </div>
  );

  if (!href) return wrapped;

  return (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {wrapped}
    </Link>
  );
}
