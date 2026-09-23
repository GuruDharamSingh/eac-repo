import type { CSSProperties, ReactNode } from "react";
import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A section heading with a bit of theatre.
//
// Four effects, all CSS, all off under `prefers-reduced-motion`:
//
//   reveal     the letters rise into place one after another
//   marquee    the title runs as a band across the section, endlessly
//   shimmer    a band of the accent colour sweeps through the letters
//   underline  an accent rule draws itself under the title
//
// Screen readers get the title once, as plain text. The split letters and
// the marquee's repeats are decoration and are hidden from them — a heading
// read out letter by letter, or three times, is not a heading.
//
// In the editor the title arrives as an editable element, not a string (it
// is typed on the page), and an element cannot be split into letters or
// repeated without repeating the text box. So while editing, reveal animates
// the whole line and marquee shows it once; the published page gets the full
// effect.
// ============================================================================

const props = [
  { name: "kicker", kind: "string", label: "Small line above", default: "" },
  { name: "title", kind: "string", label: "Title", default: "", inlineEditable: true },
  { name: "subtitle", kind: "text", label: "Line underneath", default: "", inlineEditable: true },
  {
    name: "effect",
    kind: "select",
    label: "Effect",
    default: "reveal",
    options: [
      { value: "none", label: "None" },
      { value: "reveal", label: "Reveal — letters rise in" },
      { value: "marquee", label: "Marquee — the title runs across" },
      { value: "shimmer", label: "Shimmer — a sweep of colour" },
      { value: "underline", label: "Underline — a rule draws in" },
    ],
  },
  {
    name: "size",
    kind: "select",
    label: "Size",
    default: "large",
    options: [
      { value: "regular", label: "Regular" },
      { value: "large", label: "Large" },
      { value: "huge", label: "Huge" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Alignment",
    default: "start",
    options: [
      { value: "start", label: "Left" },
      { value: "center", label: "Centred" },
    ],
  },
] as const;

export type StoreHeaderProps = PropsOf<typeof props>;

/** Letters in words, so a line only ever breaks between words. */
function Letters({ text }: { text: string }) {
  let i = 0;
  return (
    <span aria-hidden="true" className="blk-sh-letters">
      {text.split(/(\s+)/).map((word, w) =>
        /^\s+$/.test(word) ? (
          <span key={w}> </span>
        ) : (
          <span key={w} className="blk-sh-word">
            {Array.from(word).map((ch, c) => (
              <span key={c} className="blk-sh-ch" style={{ "--i": i++ } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        )
      )}
    </span>
  );
}

export function StoreHeader({
  kicker,
  title,
  subtitle,
  effect = "reveal",
  size = "large",
  align = "start",
}: StoreHeaderProps) {
  if (!kicker && !title && !subtitle) return null;
  const text = typeof title === "string" ? title : null;

  let heading: ReactNode = title;
  if (text && effect === "reveal") {
    heading = (
      <>
        <span className="blk-sr">{text}</span>
        <Letters text={text} />
      </>
    );
  }

  const marquee = effect === "marquee" && text;

  return (
    <header className="blk blk-sh" data-effect={effect} data-size={size} data-align={align} data-split={text && effect === "reveal" ? "" : undefined}>
      {kicker ? <p className="blk-sh-kicker">{kicker}</p> : null}
      {marquee ? (
        <>
          <h2 className="blk-sr">{text}</h2>
          <div className="blk-sh-marquee" aria-hidden="true">
            {/* Two identical halves; the track moves by exactly one half, so
                the loop has no seam. */}
            <div className="blk-sh-track">
              {[0, 1].map((half) => (
                <span key={half} className="blk-sh-run">
                  {[0, 1, 2].map((n) => (
                    <span key={n} className="blk-sh-item">
                      {text}
                      <span className="blk-sh-star">✦</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : title ? (
        <h2 className="blk-sh-title">{heading}</h2>
      ) : null}
      {subtitle ? <p className="blk-sh-sub">{subtitle}</p> : null}
    </header>
  );
}

export const storeHeader = defineBlock(
  {
    id: "store-header",
    category: "headers",
    label: "Store header",
    description: "A heading for a store section, with a moving effect: letters rising, a running band, a shimmer or a drawn underline.",
    props,
    memberSafe: true,
    styling: "tokens",
  },
  StoreHeader,
  () => ({
    kicker: "Available now",
    title: "Works for sale",
    subtitle: "Originals and small editions, shipped from the studio.",
    effect: "reveal" as const,
    size: "large" as const,
    align: "start" as const,
  })
);
