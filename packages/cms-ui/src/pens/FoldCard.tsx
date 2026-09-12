"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * FoldCard — React twin of the `fold-card` pen
 * (packages/silex-nextcloud-connector/src/pens/fold-card).
 *
 * Same markup, same class names, same stylesheet (fold-card.css re-exports
 * the pen's CSS), so the block an org owner drops in Silex and the card an
 * app renders look identical. What this adds is the part CSS cannot do: the
 * FLIP morph that carries the card from the panel's top band back into its
 * slot when the panel folds away — the closing shot the pen is known for.
 *
 * State is a class (`is-open`) rather than the block's checkbox, so a parent
 * can control it. Clicking anywhere non-interactive toggles, as in the pen;
 * links and buttons inside behave normally.
 */
export interface FoldCardProps {
  /** The closed card: typically an <img class="eac-pen-fold-face-img"> and a body. */
  face: ReactNode;
  /** The open panel's content. */
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  speed?: "fast" | "normal" | "slow";
  ratio?: "portrait" | "square" | "tall" | "wide";
  /** Overrides --eac-pen-accent for this card only. */
  accent?: string;
  className?: string;
  /** Accessible name for the toggle. */
  label?: string;
  /** Number of nested folds below the top band. The pen uses 3. */
  folds?: number;
}

const INTERACTIVE = "a,button,input,select,textarea,label,summary,[data-no-toggle]";

function readDurationMs(el: HTMLElement): number {
  const raw = getComputedStyle(el).getPropertyValue("--eac-pen-duration").trim();
  if (raw.endsWith("ms")) return Number.parseFloat(raw) || 1500;
  if (raw.endsWith("s")) return (Number.parseFloat(raw) || 1.5) * 1000;
  return 1500;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FoldCard({
  face,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  speed = "normal",
  ratio = "portrait",
  accent,
  className,
  label = "Open card",
  folds = 3,
}: FoldCardProps) {
  const controlled = open !== undefined;
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = controlled ? Boolean(open) : inner;

  const rootRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const panelId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInner(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange]
  );

  /**
   * FLIP, as in the pen: once the panel has folded away, measure where the
   * card would have been (the panel's top band) against where it is now,
   * invert for one frame, then release so it travels into place.
   *
   * The face is hidden for the whole fold (data-returning) and revealed on
   * the frame it is inverted, which is what the original does with
   * [data-transitioning] { visibility: hidden }. Without that the stylesheet
   * fades the face back in at 70% of the fold, in its FINAL position, and the
   * FLIP then yanks it back to the band to start travelling — one card
   * moving twice. Hidden keeps layout, so it can still be measured.
   */
  useEffect(() => {
    if (isOpen) return;
    const root = rootRef.current;
    const faceEl = faceRef.current;
    const anchor = anchorRef.current;
    if (!root || !faceEl || !anchor) return;
    if (prefersReducedMotion()) return;
    // First paint: nothing to travel from.
    if (!root.dataset.hasOpened) return;

    const reveal = () => {
      delete root.dataset.returning;
    };

    root.dataset.returning = "true";
    const duration = readDurationMs(root);
    timer.current = window.setTimeout(() => {
      const from = anchor.getBoundingClientRect();
      const to = faceEl.getBoundingClientRect();
      if (!to.width || !to.height || !from.width || !from.height) {
        reveal();
        return;
      }
      faceEl.style.setProperty("--dx", String(to.x - from.x));
      faceEl.style.setProperty("--dy", String(to.y - from.y));
      faceEl.style.setProperty("--dw", String(from.width / to.width));
      faceEl.style.setProperty("--dh", String(from.height / to.height));
      requestAnimationFrame(() => {
        // Invert and reveal in the same frame: the face becomes visible
        // already sitting on the band, never in its final place.
        faceEl.dataset.move = "pending";
        reveal();
        requestAnimationFrame(() => {
          faceEl.dataset.move = "moving";
          const done = () => {
            delete faceEl.dataset.move;
            faceEl.removeEventListener("transitionend", done);
          };
          faceEl.addEventListener("transitionend", done);
        });
      });
    }, duration);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      // Re-opened mid-fold: the FLIP never runs, so un-hide the face.
      reveal();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && rootRef.current) rootRef.current.dataset.hasOpened = "true";
  }, [isOpen]);

  function onClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE)) return;
    setOpen(!isOpen);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(!isOpen);
    } else if (event.key === "Escape" && isOpen) {
      setOpen(false);
    }
  }

  // Nested sheets, innermost last: --fold 3 hangs off the band, 1 is the bottom.
  let sheets: ReactNode = null;
  for (let i = 1; i <= folds; i++) {
    sheets = (
      <div className="eac-pen-fold-paper" style={{ "--fold": i } as CSSProperties}>
        {sheets}
      </div>
    );
  }

  const classes = ["eac-pen-fold", isOpen ? "is-open" : "", className ?? ""].filter(Boolean).join(" ");
  const style = accent ? ({ "--eac-pen-accent": accent } as CSSProperties) : undefined;

  return (
    <div
      ref={rootRef}
      className={classes}
      data-pen="fold-card"
      data-speed={speed}
      data-ratio={ratio}
      style={style}
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-controls={panelId}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className="eac-pen-fold-view eac-pen-fold-overview">
        <div ref={faceRef} className="eac-pen-fold-face">
          {face}
        </div>
        <div className="eac-pen-fold-overlay" />
      </div>
      <div id={panelId} className="eac-pen-fold-view eac-pen-fold-details">
        <div className="eac-pen-fold-paper" style={{ "--fold": 0 } as CSSProperties}>
          <div ref={anchorRef} className="eac-pen-fold-anchor" />
          {sheets}
        </div>
        <div className="eac-pen-fold-content">
          <div className="eac-pen-fold-content-inner">{children}</div>
        </div>
      </div>
    </div>
  );
}
