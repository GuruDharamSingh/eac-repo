import type { ReactNode } from "react";
import { BlockStyleWrap } from "@elkdonis/page-builder";
import { lookAttributes, type SectionLook } from "./look";

/**
 * The box every directory section sits in.
 *
 * `look` (./look) sets the ground, fonts, text size and alignment through
 * data attributes that src/theme/directory.css resolves. `blkStyle` is the
 * studio's generic Style value, drawn by the same `BlockStyleWrap` a Puck
 * block is wrapped in; with nothing set it adds no element at all.
 *
 * The section inside owns only its content and reads colours and fonts from
 * the tokens set here.
 */
export function Section({
  id,
  look,
  blkStyle,
  label,
  children,
}: {
  /** Stable id from the page definition. */
  id: string;
  look?: SectionLook;
  blkStyle?: unknown;
  /** Accessible name for the region. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <BlockStyleWrap settings={blkStyle}>
      <section id={id} className="ad-section" aria-label={label} {...lookAttributes(look)}>
        <div className="ad-section-inner">{children}</div>
      </section>
    </BlockStyleWrap>
  );
}
