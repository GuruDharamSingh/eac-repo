"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * FeedList / FeedItem — React twin of the `feed-list` pen
 * (packages/silex-nextcloud-connector/src/pens/feed-list).
 *
 * Same markup, same class names, same stylesheet, so a feed built in Silex
 * and a feed rendered by an app look identical. What this adds is the part
 * the original used GSAP's Flip plugin for and CSS cannot do: when a row
 * opens, the avatar and the text do not jump to their new places, they
 * travel there.
 *
 * The FLIP is hand-rolled — measure before the state change, measure again
 * after React has laid out, apply the inverse transform for one frame, then
 * release it with a transition. No animation library is added to the
 * monorepo for it.
 *
 * Two rules make it behave:
 *   - The list sets `data-flip="on"` only AFTER hydration, so a page with no
 *     JavaScript (and a reader who asked for reduced motion) keeps the pen's
 *     CSS transitions and still opens correctly.
 *   - The avatar is square in both states, so its FLIP scale is uniform and
 *     the image never distorts. The body is translated only, never scaled,
 *     because scaling text is the thing that always looks wrong.
 */

type FeedCtx = {
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Called synchronously in the click handler, before React changes the DOM. */
  snapshot: () => void;
};

const Ctx = createContext<FeedCtx | null>(null);

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface FeedListProps {
  children: ReactNode;
  /** "single" closes the open row when another is opened; "multi" is the pen's own toggle. */
  mode?: "single" | "multi";
  speed?: "fast" | "normal" | "slow";
  /** "stack" moves the avatar to the head of the card; "inline" leaves it at the left. */
  openLayout?: "stack" | "inline";
  frame?: "card" | "plain";
  /** Overrides --eac-pen-feed-accent for this list only. */
  accent?: string;
  className?: string;
  /** Rows open on first render, by FeedItem id. */
  defaultOpen?: string[];
}

export function FeedList({
  children,
  mode = "single",
  speed = "normal",
  openLayout = "stack",
  frame = "card",
  accent,
  className,
  defaultOpen,
}: FeedListProps) {
  const [open, setOpen] = useState<string[]>(() => defaultOpen ?? []);
  const [flip, setFlip] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const firstRects = useRef<Map<HTMLElement, DOMRect> | null>(null);

  // After hydration only, and never when the reader asked for less motion:
  // with this on, the stylesheet hands the avatar and body over to the FLIP.
  useEffect(() => {
    if (!reducedMotion()) setFlip(true);
  }, []);

  const snapshot = useCallback(() => {
    const root = listRef.current;
    if (!root) return;
    const map = new Map<HTMLElement, DOMRect>();
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      // Measured as it is, mid-flight transform included, so interrupting an
      // animation continues from where it actually was.
      map.set(el, el.getBoundingClientRect());
    });
    firstRects.current = map;
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setOpen((current) => {
        const isOpen = current.includes(id);
        if (mode === "single") return isOpen ? [] : [id];
        return isOpen ? current.filter((x) => x !== id) : [...current, id];
      });
    },
    [mode]
  );

  const openKey = open.join("|");

  useLayoutEffect(() => {
    const before = firstRects.current;
    firstRects.current = null;
    const root = listRef.current;
    if (!before || !root || !flip) return;

    const els: HTMLElement[] = [];
    before.forEach((_, el) => {
      if (el.isConnected) els.push(el);
    });
    if (!els.length) return;

    // Clear anything in flight so the second measurement is the real final
    // box, then read every one of them before writing any (one reflow, not N).
    for (const el of els) {
      el.style.transition = "none";
      el.style.transform = "";
    }
    void root.offsetWidth;

    const moves: Array<[HTMLElement, string]> = [];
    for (const el of els) {
      const first = before.get(el);
      const last = el.getBoundingClientRect();
      if (!first || !first.width || !last.width) continue;
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      // Uniform, and only for the avatar: it is square in both states.
      const scale = el.dataset.flip === "avatar" ? first.width / last.width : 1;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.005) continue;
      moves.push([
        el,
        `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)` +
          (scale === 1 ? "" : ` scale(${scale.toFixed(4)})`),
      ]);
    }

    if (!moves.length) {
      for (const el of els) el.style.transition = "";
      return;
    }

    for (const [el, transform] of moves) {
      el.style.transformOrigin = "top left";
      el.style.willChange = "transform";
      el.style.transform = transform;
    }

    const frameId = requestAnimationFrame(() => {
      for (const [el] of moves) {
        el.style.transition =
          "transform var(--eac-pen-feed-duration, 500ms) var(--eac-pen-feed-easing, ease)";
        el.style.transform = "";
        const done = () => {
          el.style.willChange = "";
          el.style.transition = "";
          el.style.transformOrigin = "";
          el.removeEventListener("transitionend", done);
        };
        el.addEventListener("transitionend", done);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [openKey, flip]);

  const ctx = useMemo<FeedCtx>(
    () => ({ isOpen: (id) => open.includes(id), toggle, snapshot }),
    [open, toggle, snapshot]
  );

  const classes = ["eac-pen-feed", className ?? ""].filter(Boolean).join(" ");
  const style = accent
    ? ({ "--eac-pen-feed-accent": accent } as CSSProperties)
    : undefined;

  return (
    <Ctx.Provider value={ctx}>
      <div
        className={classes}
        data-pen="feed-list"
        data-speed={speed}
        data-open-layout={openLayout}
        data-frame={frame}
        data-flip={flip ? "on" : undefined}
        style={style}
      >
        <ul className="eac-pen-feed-list" ref={listRef}>
          {children}
        </ul>
      </div>
    </Ctx.Provider>
  );
}

export interface FeedItemProps {
  title: ReactNode;
  /** Expanded content. Links and buttons in here are not swallowed by the row. */
  children?: ReactNode;
  /** Stable id; needed only when a parent wants to control or preset this row. */
  id?: string;
  avatar?: string | null;
  avatarAlt?: string;
  kicker?: ReactNode;
  summary?: ReactNode;
  meta?: ReactNode;
}

const INTERACTIVE = "a,button,input,select,textarea,label,summary,[data-no-toggle]";

export function FeedItem({
  title,
  children,
  id,
  avatar,
  avatarAlt = "",
  kicker,
  summary,
  meta,
}: FeedItemProps) {
  const autoId = useId();
  const rowId = id ?? autoId;
  const panelId = `${rowId}-panel`;
  const ctx = useContext(Ctx);
  const open = ctx?.isOpen(rowId) ?? false;

  function activate() {
    if (!ctx) return;
    // Before the state change, so the FLIP has a "from" to work with.
    ctx.snapshot();
    ctx.toggle(rowId);
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    activate();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    } else if (event.key === "Escape" && open) {
      activate();
    }
  }

  return (
    <li className="eac-pen-feed-li">
      <div
        className={`eac-pen-feed-item${open ? " is-open" : ""}`}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="eac-pen-feed-avatar" data-flip="avatar" src={avatar} alt={avatarAlt} />
        ) : (
          <span className="eac-pen-feed-avatar" data-flip="avatar" aria-hidden />
        )}
        <div className="eac-pen-feed-body" data-flip="body">
          {kicker ? <p className="eac-pen-feed-kicker">{kicker}</p> : null}
          <h3 className="eac-pen-feed-title">{title}</h3>
          {summary ? <p className="eac-pen-feed-summary">{summary}</p> : null}
          {meta ? <p className="eac-pen-feed-meta">{meta}</p> : null}
        </div>
        <div className="eac-pen-feed-extra" id={panelId}>
          <div className="eac-pen-feed-extra-inner">{children}</div>
        </div>
      </div>
    </li>
  );
}
