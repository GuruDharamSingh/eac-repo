import type { ReactNode } from "react";
import { layoutChoice, type RecordLayout, type RecordLayoutChoice, type RecordWhere } from "./placement";

// ============================================================================
// The two wrappers every record block draws, so the width mechanism and the
// editor marks are the same everywhere:
//
//   <div class="blk-rec {name}" data-layout data-choice data-in data-top>
//     <div class="blk-rec-frame {name}-frame">     container (inline-size)
//       ...the record
//       <p class="blk-rec-why {name}-why">          editor only, aria-hidden
//
// `name` is the app's own class (e.g. "ktp-piece"): the shared classes are
// ADDED, so the app's CSS, part selectors (`> .ktp-piece`) and container name
// keep working. The frame is an inline-size container, so the block needs a
// parent that gives it a definite width (a grid track, a flex basis, a block
// box); a shrink-to-fit parent collapses it. Server-safe: no hooks.
// ============================================================================

export interface RecordFrameProps {
  /** The app's class for the block root; the frame gets `{name}-frame`, the line `{name}-why`. */
  name?: string;
  layout: RecordLayout;
  /**
   * The author's layout choice, drawn as `data-choice`. Pass the raw prop:
   * it goes through layoutChoice, so a missing or unknown value draws "auto".
   */
  choice?: RecordLayoutChoice | (string & {}) | null;
  /** From the resolver: `where` -> `data-in`, `top` -> `data-top`. */
  placement?: { where?: RecordWhere; top?: boolean } | null;
  /** The block draws its empty placeholder (`data-empty`). */
  empty?: boolean;
  /** The editor-only "why this layout" line; nothing is drawn when empty. See describeLayout. */
  why?: string | null;
  children?: ReactNode;
}

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

export function RecordFrame({ name, layout, choice, placement, empty, why, children }: RecordFrameProps) {
  return (
    <div
      className={cx("blk-rec", name)}
      data-layout={layout}
      data-empty={empty ? "true" : undefined}
      data-choice={layoutChoice(choice)}
      data-in={placement?.where}
      data-top={placement?.top ? "true" : undefined}
    >
      <div className={cx("blk-rec-frame", name && `${name}-frame`)}>
        {children}
        {why ? (
          <p className={cx("blk-rec-why", name && `${name}-why`)} aria-hidden="true">
            {why}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The editor's "Choose a ..." placeholder for an empty binding. Draw it only when `drawn`. */
export function RecordEmpty({ title, body, className }: { title: string; body: ReactNode; className?: string }) {
  return (
    <div className={cx("blk-rec-empty", className)}>
      <b>{title}</b>
      <div>{body}</div>
    </div>
  );
}
