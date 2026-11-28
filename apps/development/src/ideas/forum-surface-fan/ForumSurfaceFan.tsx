"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  ALL_BOARDS,
  BOARD_GROUPS,
  DRAFTS,
  HAPPENING,
  RECENT,
  ROUTES,
  TERMS,
  THREADS,
  VIEWER,
  WHO_IS_HERE,
  WIKI_PAGES,
  type Recent,
} from "./data";
import { PHONE_MAX, type FanShape, type FanTuning } from "./geometry";
import { SurfaceFan, type FanApi, type FanTab } from "./SurfaceFan";
import "./forum-surface-fan.css";

// ============================================================================
// Grand Forum without the rail (mock, 2026-11-27): a top bar of drop-down menus replaces the left rail, the "Aa"
// reader controls fold into the account menu, and a SurfaceFan on the right edge holds tools and quick navigation.
// Everything is sample data (./data.ts); nothing here reads or writes the forum. Choices persist in this browser only.
// ============================================================================

type Mode = "light" | "dark";
type Size = "standard" | "large" | "largest";
type Layout = "board" | "cards";
type Frame = "fit" | "phone";

interface Tune extends FanTuning {
  speed: number;
  stagger: number;
  dim: number;
  rm: boolean;
  goTo: boolean;
}

const KEY = "forum-fan:v1";
const DEFAULT_TUNE: Tune = { shape: "arc", radius: 430, spread: 56, offset: 140, length: 210, level: false, speed: 1, stagger: 40, dim: 0.32, rm: false, goTo: true };

function load<T>(fallback: T): T {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function ForumSurfaceFan() {
  const [mode, setMode] = useState<Mode>("light");
  const [textSize, setTextSize] = useState<Size>("standard");
  const [layout, setLayout] = useState<Layout>("board");
  const [frame, setFrame] = useState<Frame>("fit");
  const [tune, setTune] = useState<Tune>(DEFAULT_TUNE);
  const [hydrated, setHydrated] = useState(false);
  const [fan, setFan] = useState<{ open: boolean; active: string | null; sub: string | null }>({ open: false, active: null, sub: null });
  const [toast, setToast] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>(RECENT);
  const [remember, setRemember] = useState(true);
  const [osReduce, setOsReduce] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 820 });

  useEffect(() => {
    const s = load({ mode, textSize, layout, frame, tune });
    setMode(s.mode);
    setTextSize(s.textSize);
    setLayout(s.layout);
    setFrame(s.frame);
    setTune({ ...DEFAULT_TUNE, ...s.tune });
    setHydrated(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setOsReduce(mq.matches);
    const on = () => setOsReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ mode, textSize, layout, frame, tune }));
    } catch {
      /* private window: choices are not kept */
    }
  }, [hydrated, mode, textSize, layout, frame, tune]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [frame]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const phone = size.w <= PHONE_MAX;
  const visit = (r: Omit<Recent, "when">) => {
    if (remember) setRecent((xs) => [{ ...r, when: "just now" }, ...xs.filter((x) => x.path !== r.path)].slice(0, 8));
    setToast(`Mock: would open ${r.path}`);
  };
  const openFanAt = (active: string, sub: string | null = null) => setFan({ open: true, active, sub });

  const tabs = buildTabs({ recent, setRecent, remember, setRemember, visit, toast: setToast, goTo: tune.goTo });
  const t = (patch: Partial<Tune>) => setTune((x) => ({ ...x, ...patch }));

  return (
    <div className="ffan-wrap">
      <Controls
        mode={mode}
        setMode={setMode}
        frame={frame}
        setFrame={setFrame}
        tune={tune}
        t={t}
        reset={() => setTune(DEFAULT_TUNE)}
        osReduce={osReduce}
      />
      <div className="ffan-stage-holder" data-frame={frame}>
        <div
          ref={stage}
          className="ffan gf-mock"
          data-mode={mode}
          data-size={textSize}
          data-layout={layout}
          data-phone={phone || undefined}
          aria-label="Forum mock"
        >
          <div className="ffan-scroll" inert={fan.open}>
            <TopBar
              phone={phone}
              mode={mode}
              setMode={setMode}
              textSize={textSize}
              setTextSize={setTextSize}
              layout={layout}
              setLayout={setLayout}
              visit={visit}
              openFanAt={openFanAt}
            />
            <Home layout={layout} visit={visit} phone={phone} />
          </div>
          <SurfaceFan
            tabs={tabs}
            tuning={tune}
            size={size}
            duration={Math.round(340 / tune.speed)}
            stagger={Math.round(tune.stagger / tune.speed)}
            dim={tune.dim}
            reduceMotion={tune.rm || osReduce}
            open={fan.open}
            active={fan.active}
            sub={fan.sub}
            onChange={setFan}
          />
          {toast ? (
            <div className="ffan-toast" role="status">
              {toast}
            </div>
          ) : null}
        </div>
      </div>
      <p className="ffan-note">
        Sample data only. Tabs map to: Dictionary entry → {ROUTES.define}; New category → {ROUTES.category}; New topic → {ROUTES.topic}; New thread →{" "}
        {ROUTES.thread}; Publish → {ROUTES.publish}; Recently → {ROUTES.recent}.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Mock controls (not part of the design)

function Controls(props: {
  mode: Mode;
  setMode: (m: Mode) => void;
  frame: Frame;
  setFrame: (f: Frame) => void;
  tune: Tune;
  t: (p: Partial<Tune>) => void;
  reset: () => void;
  osReduce: boolean;
}) {
  const { mode, setMode, frame, setFrame, tune, t, reset, osReduce } = props;
  const shapes: { v: FanShape; label: string }[] = [
    { v: "arc", label: "Arc (rays, equal bars)" },
    { v: "line", label: "Rays to a straight edge" },
    { v: "stack", label: "Straight stack (level)" },
  ];
  const range = (label: string, key: keyof Tune, min: number, max: number, step: number, fmt: (v: number) => string = String) => (
    <label className="ffan-ctl-range">
      <span>
        {label} <b>{fmt(tune[key] as number)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={tune[key] as number} onChange={(e) => t({ [key]: Number(e.target.value) } as Partial<Tune>)} />
    </label>
  );
  return (
    <div className="ffan-ctl" aria-label="Mock controls">
      <span className="ffan-ctl-tag">Mock controls, not part of the design</span>
      <div className="ffan-ctl-row">
        <Seg label="Theme" value={mode} options={[["light", "Light"], ["dark", "Dark"]]} onChange={(v) => setMode(v as Mode)} />
        <Seg label="Frame" value={frame} options={[["fit", "Full width"], ["phone", "Phone 390"]]} onChange={(v) => setFrame(v as Frame)} />
        <Seg label="Geometry" value={tune.shape} options={shapes.map((s) => [s.v, s.label])} onChange={(v) => t({ shape: v as FanShape })} />
      </div>
      <div className="ffan-ctl-row">
        {range("Radius", "radius", 260, 640, 10, (v) => `${v}px`)}
        {range("Spread", "spread", 20, 110, 2, (v) => `${v}°`)}
        {range("Origin past edge", "offset", 0, 320, 10, (v) => `${v}px`)}
        {range("Tab length", "length", 140, 320, 10, (v) => `${v}px`)}
        {range("Speed", "speed", 0.25, 2, 0.05, (v) => `${v.toFixed(2)}×`)}
        {range("Stagger", "stagger", 0, 120, 5, (v) => `${v}ms`)}
        {range("Dim", "dim", 0, 0.7, 0.02, (v) => v.toFixed(2))}
      </div>
      <div className="ffan-ctl-row">
        <label className="ffan-ctl-check">
          <input type="checkbox" checked={tune.level} onChange={(e) => t({ level: e.target.checked })} /> Keep labels level
        </label>
        <label className="ffan-ctl-check">
          <input type="checkbox" checked={tune.rm || osReduce} disabled={osReduce} onChange={(e) => t({ rm: e.target.checked })} /> Reduced motion
          {osReduce ? " (set by this device)" : ""}
        </label>
        <label className="ffan-ctl-check">
          <input type="checkbox" checked={tune.goTo} onChange={(e) => t({ goTo: e.target.checked })} /> Fifth tab: Go to
        </label>
        <button type="button" className="ffan-ctl-reset" onClick={reset}>
          Reset tuning
        </button>
      </div>
    </div>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (v: string) => void }) {
  return (
    <div className="ffan-seg" role="radiogroup" aria-label={label}>
      <span className="ffan-seg-label">{label}</span>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Top bar

type Visit = (r: Omit<Recent, "when">) => void;

function useMenuBar() {
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  return { open, setOpen, bar };
}

function Menu(props: { id: string; label: ReactNode; aria?: string; open: string | null; setOpen: (v: string | null) => void; align?: "left" | "right"; wide?: boolean; children: ReactNode }) {
  const { id, label, aria, open, setOpen, align = "left", wide, children } = props;
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const isOpen = open === id;
  const focusFirst = () => window.setTimeout(() => panel.current?.querySelector<HTMLElement>("a, button, input")?.focus(), 20);
  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(null);
      btn.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>("a, button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };
  return (
    <div className="ffan-menu" data-open={isOpen || undefined}>
      <button
        ref={btn}
        type="button"
        className="ffan-menu-btn"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={aria}
        onClick={() => setOpen(isOpen ? null : id)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(id);
            focusFirst();
          }
          if (e.key === "Escape") setOpen(null);
        }}
      >
        {label}
        <span className="ffan-caret" aria-hidden>
          ▾
        </span>
      </button>
      {isOpen ? (
        <div ref={panel} className="ffan-menu-panel" data-align={align} data-wide={wide || undefined} onKeyDown={onPanelKey}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Item({ children, meta, onClick }: { children: ReactNode; meta?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="ffan-item" onClick={onClick}>
      <span>{children}</span>
      {meta != null ? <span className="ffan-item-meta">{meta}</span> : null}
    </button>
  );
}

function TopBar(props: {
  phone: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  textSize: Size;
  setTextSize: (s: Size) => void;
  layout: Layout;
  setLayout: (l: Layout) => void;
  visit: Visit;
  openFanAt: (tab: string, sub?: string | null) => void;
}) {
  const { phone, mode, setMode, textSize, setTextSize, layout, setLayout, visit, openFanAt } = props;
  const { open, setOpen, bar } = useMenuBar();
  const [searchOpen, setSearchOpen] = useState(false);
  const go = (r: Omit<Recent, "when">) => {
    setOpen(null);
    visit(r);
  };
  const fanAt = (tab: string, sub?: string) => {
    setOpen(null);
    openFanAt(tab, sub ?? null);
  };

  const categories = (
    <div className="ffan-cats">
      {BOARD_GROUPS.map((g) => (
        <div key={g.org} className="ffan-cat-group">
          <div className="ffan-menu-head">{g.org}</div>
          {g.boards.map((b) => (
            <Item key={b.slug} meta={b.threads} onClick={() => go({ kind: "board", title: b.name, path: `/o/${g.org.toLowerCase().replace(/\s+/g, "-")}/${b.slug}` })}>
              {b.name}
            </Item>
          ))}
        </div>
      ))}
      <div className="ffan-menu-foot">
        <Item onClick={() => go({ kind: "board", title: "All orgs", path: "/orgs" })}>All orgs</Item>
        <Item onClick={() => fanAt("new", "category")}>＋ New category</Item>
      </div>
    </div>
  );
  const read = (
    <>
      <Item onClick={() => go({ kind: "board", title: "Home", path: "/" })}>Home</Item>
      <Item onClick={() => go({ kind: "board", title: "Latest", path: "/latest" })}>Latest</Item>
      <Item meta={VIEWER.unread} onClick={() => go({ kind: "board", title: "Unread", path: "/unread" })}>
        Unread
      </Item>
      <Item onClick={() => go({ kind: "board", title: "Watching", path: "/watching" })}>Watching</Item>
      <Item onClick={() => go({ kind: "board", title: "Bookmarks", path: "/bookmarks" })}>Bookmarks</Item>
      <div className="ffan-menu-sep" />
      <Item onClick={() => go({ kind: "board", title: "Topics", path: "/topics" })}>Topics</Item>
      <Item onClick={() => go({ kind: "member", title: "Members", path: "/members" })}>Members</Item>
    </>
  );
  const happening = (
    <>
      {HAPPENING.map((h) => (
        <Item key={h.title} meta={h.when} onClick={() => go({ kind: "board", title: h.title, path: "/happening" })}>
          {h.title}
        </Item>
      ))}
      <div className="ffan-menu-sep" />
      <div className="ffan-menu-head">Who's here</div>
      <div className="ffan-here">
        {WHO_IS_HERE.map((n) => (
          <span key={n} className="ffan-avatar" title={n}>
            {initials(n)}
          </span>
        ))}
      </div>
      <Item onClick={() => go({ kind: "board", title: "Happening", path: "/happening" })}>All of Happening</Item>
    </>
  );
  const wiki = (
    <>
      <div className="ffan-menu-head">Recently edited</div>
      {WIKI_PAGES.map((w) => (
        <Item key={w.slug} meta={w.edited} onClick={() => go({ kind: "wiki", title: w.title, path: `/wiki/${w.slug}` })}>
          {w.title}
        </Item>
      ))}
      <div className="ffan-menu-sep" />
      <Item onClick={() => go({ kind: "wiki", title: "Wiki", path: "/wiki" })}>All pages</Item>
      <Item onClick={() => go({ kind: "wiki", title: "New page", path: "/wiki/new" })}>＋ Create page</Item>
    </>
  );
  const dictionary = (
    <>
      <div className="ffan-menu-head">Recent words</div>
      {TERMS.slice(0, 4).map((w) => (
        <Item key={w.word} onClick={() => go({ kind: "word", title: w.word, path: `/dictionary#${w.word.toLowerCase()}` })}>
          {w.word}
        </Item>
      ))}
      <div className="ffan-menu-sep" />
      <Item onClick={() => go({ kind: "word", title: "Dictionary", path: "/dictionary" })}>A–Z</Item>
      <Item onClick={() => fanAt("define")}>§ Define a word</Item>
    </>
  );
  const account = (
    <div className="ffan-account">
      <div className="ffan-account-who">
        <span className="ffan-avatar ffan-avatar-lg">{VIEWER.initials}</span>
        <span>
          <b>{VIEWER.name}</b>
          <br />
          <small>Signed in · network account</small>
        </span>
      </div>
      <Item onClick={() => go({ kind: "member", title: "My page", path: "/members/ari-d" })}>My page</Item>
      <Item meta={VIEWER.notifications} onClick={() => go({ kind: "board", title: "Notifications", path: "/notifications" })}>
        Notifications
      </Item>
      <Item onClick={() => go({ kind: "board", title: "Insights", path: "/insights" })}>Insights</Item>
      <div className="ffan-menu-sep" />
      <div className="ffan-menu-head">Reading (was "Aa")</div>
      <MiniSeg label="Text size" value={textSize} options={[["standard", "Standard"], ["large", "Large"], ["largest", "Largest"]]} onChange={(v) => setTextSize(v as Size)} />
      <MiniSeg label="Layout" value={layout} options={[["board", "List"], ["cards", "Cards"]]} onChange={(v) => setLayout(v as Layout)} />
      <MiniSeg label="Background" value={mode} options={[["light", "☀ Light"], ["dark", "◑ Dark"]]} onChange={(v) => setMode(v as Mode)} />
      <div className="ffan-menu-sep" />
      <Item onClick={() => go({ kind: "board", title: "Sign out", path: "/logout" })}>Sign out</Item>
    </div>
  );

  const search = (
    <form
      className="ffan-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        visit({ kind: "board", title: `Search: ${q}`, path: `/search?q=${encodeURIComponent(String(q ?? ""))}` });
      }}
    >
      <input name="q" type="search" placeholder="Search the forum" aria-label="Search the forum" />
    </form>
  );

  if (phone) {
    return (
      <header ref={bar} className="ffan-bar" data-phone>
        <div className="ffan-bar-row">
          <span className="ffan-brand">The forum</span>
          <span className="ffan-bar-gap" />
          <button type="button" className="ffan-icon-btn" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
            ⌕
          </button>
          <Menu id="browse" label="Browse" open={open} setOpen={setOpen} align="right" wide>
            <div className="ffan-browse">
              <details open>
                <summary>Read</summary>
                {read}
              </details>
              <details>
                <summary>Categories</summary>
                {categories}
              </details>
              <details>
                <summary>Happening</summary>
                {happening}
              </details>
              <details>
                <summary>Wiki</summary>
                {wiki}
              </details>
              <details>
                <summary>Dictionary</summary>
                {dictionary}
              </details>
            </div>
          </Menu>
          <Menu id="me" label={<span className="ffan-avatar">{VIEWER.initials}</span>} aria="Account and reading options" open={open} setOpen={setOpen} align="right">
            {account}
          </Menu>
        </div>
        {searchOpen ? <div className="ffan-bar-row">{search}</div> : null}
      </header>
    );
  }

  return (
    <header ref={bar} className="ffan-bar">
      <div className="ffan-bar-row">
        <span className="ffan-brand">
          The forum <small>Grand Forum</small>
        </span>
        <nav className="ffan-bar-menus" aria-label="Forum">
          <Menu id="read" label="Read" open={open} setOpen={setOpen}>
            {read}
          </Menu>
          <Menu id="cats" label="Categories" open={open} setOpen={setOpen} wide>
            {categories}
          </Menu>
          <Menu id="happening" label="Happening" open={open} setOpen={setOpen}>
            {happening}
          </Menu>
          <Menu id="wiki" label="Wiki" open={open} setOpen={setOpen}>
            {wiki}
          </Menu>
          <Menu id="dict" label="Dictionary" open={open} setOpen={setOpen}>
            {dictionary}
          </Menu>
        </nav>
        <span className="ffan-bar-gap" />
        {search}
        <Menu
          id="me"
          label={
            <>
              <span className="ffan-avatar">{VIEWER.initials}</span>
              <span className="ffan-badge" aria-label={`${VIEWER.notifications} notifications`}>
                {VIEWER.notifications}
              </span>
            </>
          }
          aria="Account and reading options"
          open={open}
          setOpen={setOpen}
          align="right"
        >
          {account}
        </Menu>
      </div>
    </header>
  );
}

function MiniSeg({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (v: string) => void }) {
  return (
    <div className="ffan-miniseg" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div>
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Home (the current forum content area, without the rail)

function Home({ layout, visit, phone }: { layout: Layout; visit: Visit; phone: boolean }) {
  const [tab, setTab] = useState("latest");
  return (
    <main className="ffan-main">
      <div className="ffan-main-head">
        <h1>Home</h1>
        <div className="ffan-tabs" role="tablist" aria-label="Order">
          {[
            ["latest", "Latest"],
            ["top", "Top"],
            ["unread", `Unread (${VIEWER.unread})`],
          ].map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <section className="ffan-happening" aria-label="Happening">
        {HAPPENING.slice(0, phone ? 2 : 3).map((h) => (
          <button key={h.title} type="button" className="ffan-happ" onClick={() => visit({ kind: "board", title: h.title, path: "/happening" })}>
            <span className="ffan-happ-when">{h.when}</span>
            <span className="ffan-happ-title">{h.title}</span>
            <span className="ffan-happ-where">{h.where}</span>
          </button>
        ))}
      </section>

      <ol className="ffan-threads" data-layout={layout}>
        {THREADS.filter((x) => tab !== "unread" || x.unread).map((th) => (
          <li key={th.id}>
            <button type="button" className="ffan-thread" data-unread={th.unread || undefined} onClick={() => visit({ kind: "thread", title: th.title, path: `/t/${th.id}/${th.slug}` })}>
              <span className="ffan-avatar">{initials(th.author)}</span>
              <span className="ffan-thread-body">
                <span className="ffan-thread-title">
                  {th.pinned ? <span className="ffan-pin">Pinned</span> : null}
                  {th.title}
                </span>
                <span className="ffan-thread-ex">{th.excerpt}</span>
                <span className="ffan-thread-meta">
                  <span className="ffan-board">{th.board}</span> {th.author} · {th.last}
                </span>
              </span>
              <span className="ffan-thread-stats">
                <b>{th.replies}</b> replies
                <br />
                {th.views} views
              </span>
            </button>
          </li>
        ))}
      </ol>
    </main>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();

// ---------------------------------------------------------------------------------------------------------------
// Fan tabs

function Toggle({ label, on, set, note }: { label: string; on: boolean; set: (v: boolean) => void; note?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="sfan-toggle" data-fan-item onClick={() => set(!on)}>
      <span>
        {label}
        {note ? <small>{note}</small> : null}
      </span>
      <span className="sfan-switch" aria-hidden />
    </button>
  );
}

function Row({ children, meta, sub, onClick, current }: { children: ReactNode; meta?: ReactNode; sub?: boolean; onClick: () => void; current?: boolean }) {
  return (
    <button type="button" className="sfan-row" data-fan-item data-has-sub={sub || undefined} aria-current={current || undefined} onClick={onClick}>
      {sub ? (
        <span className="sfan-row-more" aria-hidden>
          ◂
        </span>
      ) : null}
      <span className="sfan-row-label">{children}</span>
      {meta != null ? <span className="sfan-row-meta">{meta}</span> : null}
    </button>
  );
}

function Route({ children }: { children: ReactNode }) {
  return <p className="sfan-route">{children}</p>;
}

function DefinePanel({ api, toast }: { api: FanApi; toast: (s: string) => void }) {
  const [word, setWord] = useState("");
  const [gloss, setGloss] = useState("");
  return (
    <>
      <form
        className="sfan-form"
        onSubmit={(e) => {
          e.preventDefault();
          toast(word ? `Mock: "${word}" would be added to the dictionary` : "Type a word first");
        }}
      >
        <label>
          The word or phrase
          <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="e.g. Sgraffito" />
        </label>
        <label>
          What it means
          <textarea rows={3} value={gloss} onChange={(e) => setGloss(e.target.value)} />
        </label>
        <div className="sfan-actions">
          <button type="submit" className="sfan-primary">
            Add
          </button>
          <button type="button" className="sfan-quiet" data-fan-item data-has-sub onClick={() => api.openSub("options")}>
            ◂ Options
          </button>
        </div>
      </form>
      <div className="sfan-sep" />
      <div className="sfan-subhead">Recent words</div>
      {TERMS.slice(0, 4).map((t) => (
        <Row key={t.word} sub current={api.sub === `word:${t.word}`} onClick={() => api.openSub(`word:${t.word}`)}>
          {t.word}
        </Row>
      ))}
      <Route>{ROUTES.define}</Route>
    </>
  );
}

function DefineOptions() {
  const [wiki, setWiki] = useState(false);
  const [link, setLink] = useState(true);
  const [watch, setWatch] = useState(true);
  return (
    <>
      <Toggle label="Also start a wiki page" note="Creates /wiki/<word> with this text" on={wiki} set={setWiki} />
      <Toggle label="Underline the word in threads" note="Readers can hover for the meaning" on={link} set={setLink} />
      <Toggle label="Tell me when someone edits it" on={watch} set={setWatch} />
      <div className="sfan-subhead">Order on /dictionary</div>
      <SegSmall options={["A–Z", "Most recent"]} />
    </>
  );
}

function SegSmall({ options }: { options: string[] }) {
  const [v, setV] = useState(options[0]);
  return (
    <div className="sfan-seg" role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={v === o} data-fan-item onClick={() => setV(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function NewForm({ kind, toast }: { kind: string; toast: (s: string) => void }) {
  const [watch, setWatch] = useState(true);
  const [announce, setAnnounce] = useState(false);
  const submit = (msg: string) => (e: FormEvent) => {
    e.preventDefault();
    toast(msg);
  };
  if (kind === "category")
    return (
      <form className="sfan-form" onSubmit={submit("Mock: the category would be created")}>
        <label>
          Name
          <input placeholder="e.g. Printmaking" />
        </label>
        <label>
          In
          <select defaultValue="Network">
            {BOARD_GROUPS.map((g) => (
              <option key={g.org}>{g.org}</option>
            ))}
          </select>
        </label>
        <label>
          What belongs here
          <textarea rows={2} />
        </label>
        <div className="sfan-actions">
          <button type="submit" className="sfan-primary">
            Create
          </button>
        </div>
        <Route>{ROUTES.category} · org owners and guides</Route>
      </form>
    );
  if (kind === "topic")
    return (
      <form className="sfan-form" onSubmit={submit("Mock: the topic would go to review")}>
        <label>
          Topic
          <input placeholder="e.g. Natural pigments" />
        </label>
        <label>
          Why it should be a topic
          <textarea rows={3} />
        </label>
        <Toggle label="Tell me when it is reviewed" on={watch} set={setWatch} />
        <div className="sfan-actions">
          <button type="submit" className="sfan-primary">
            Propose
          </button>
        </div>
        <Route>{ROUTES.topic}</Route>
      </form>
    );
  return (
    <form className="sfan-form" onSubmit={submit("Mock: the thread would be posted")}>
      <label>
        Title
        <input placeholder="What is it about?" />
      </label>
      <label>
        Where
        <select defaultValue="General">
          {ALL_BOARDS.map((b) => (
            <option key={b.slug} value={b.name}>
              {b.org} · {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Body
        <textarea rows={4} />
      </label>
      <Toggle label="Watch replies" on={watch} set={setWatch} />
      <Toggle label="Also show in Happening" note="For a dated event" on={announce} set={setAnnounce} />
      <div className="sfan-actions">
        <button type="submit" className="sfan-primary">
          Post
        </button>
        <button type="button" className="sfan-quiet" onClick={() => toast("Mock: would open /draw/new")}>
          ✎ or start a drawing
        </button>
      </div>
      <Route>{ROUTES.thread}</Route>
    </form>
  );
}

function PublishSettings({ id, toast }: { id: string; toast: (s: string) => void }) {
  const d = DRAFTS.find((x) => x.id === id) ?? DRAFTS[0];
  const [forum, setForum] = useState(true);
  const [page, setPage] = useState(true);
  const [feed, setFeed] = useState(false);
  const [replies, setReplies] = useState(true);
  const [aud, setAud] = useState("Anyone");
  return (
    <div className="sfan-form">
      <p className="sfan-draft-title">
        <small>{d.kind}</small>
        <br />
        {d.title}
      </p>
      <div className="sfan-subhead">Show on</div>
      <Toggle label="The forum" note="As a thread in General" on={forum} set={setForum} />
      <Toggle label="My page" on={page} set={setPage} />
      <Toggle label="Network feed" note="arts-collective.com" on={feed} set={setFeed} />
      <div className="sfan-subhead">Who can read it</div>
      <div className="sfan-seg" role="radiogroup" aria-label="Who can read it">
        {["Anyone", "Members", "Core group"].map((o) => (
          <button key={o} type="button" role="radio" aria-checked={aud === o} data-fan-item onClick={() => setAud(o)}>
            {o}
          </button>
        ))}
      </div>
      <Toggle label="Allow replies" on={replies} set={setReplies} />
      <div className="sfan-actions">
        <button type="button" className="sfan-primary" onClick={() => toast(`Mock: "${d.title}" would be published`)}>
          Publish
        </button>
        <button type="button" className="sfan-quiet" onClick={() => toast("Mock: would open the piece in Studio")}>
          Open in Studio ↗
        </button>
      </div>
    </div>
  );
}

function RecentSettings({ remember, setRemember, clear }: { remember: boolean; setRemember: (v: boolean) => void; clear: () => void }) {
  const [kinds, setKinds] = useState<Record<string, boolean>>({ Threads: true, Boards: true, "Wiki pages": true, Words: true, Members: false });
  return (
    <>
      <Toggle label="Remember pages I visit" note="Kept in this browser" on={remember} set={setRemember} />
      <div className="sfan-subhead">Include</div>
      {Object.entries(kinds).map(([k, v]) => (
        <Toggle key={k} label={k} on={v} set={(x) => setKinds((o) => ({ ...o, [k]: x }))} />
      ))}
      <div className="sfan-subhead">Keep</div>
      <SegSmall options={["5", "10", "20"]} />
      <div className="sfan-actions">
        <button type="button" className="sfan-quiet" data-fan-item onClick={clear}>
          Clear the list
        </button>
      </div>
    </>
  );
}

function GoTo({ visit }: { visit: Visit }) {
  const [q, setQ] = useState("");
  const all: Omit<Recent, "when">[] = [
    ...ALL_BOARDS.map((b) => ({ kind: "board" as const, title: b.name, path: `/o/${b.org.toLowerCase().replace(/\s+/g, "-")}/${b.slug}` })),
    ...THREADS.map((t) => ({ kind: "thread" as const, title: t.title, path: `/t/${t.id}/${t.slug}` })),
    ...WIKI_PAGES.map((w) => ({ kind: "wiki" as const, title: w.title, path: `/wiki/${w.slug}` })),
    ...TERMS.map((w) => ({ kind: "word" as const, title: w.word, path: `/dictionary#${w.word.toLowerCase()}` })),
  ];
  const hits = q ? all.filter((x) => x.title.toLowerCase().includes(q.toLowerCase())).slice(0, 7) : all.slice(0, 6);
  return (
    <>
      <label className="sfan-form">
        <span className="sfan-sr">Go to</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Board, thread, page or word" />
      </label>
      {hits.map((h) => (
        <Row key={h.path} meta={h.kind} onClick={() => visit(h)}>
          {h.title}
        </Row>
      ))}
      {!hits.length ? <p className="sfan-empty">Nothing matches.</p> : null}
    </>
  );
}

function buildTabs(ctx: {
  recent: Recent[];
  setRecent: (r: Recent[]) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
  visit: Visit;
  toast: (s: string) => void;
  goTo: boolean;
}): FanTab[] {
  const { recent, setRecent, remember, setRemember, visit, toast, goTo } = ctx;
  const tabs: FanTab[] = [
    {
      id: "define",
      label: "Dictionary entry",
      icon: "§",
      hint: "define",
      title: "Define a word",
      panel: (api) => <DefinePanel api={api} toast={toast} />,
      sub: (key) => {
        if (key === "options") return <DefineOptions />;
        const t = TERMS.find((x) => `word:${x.word}` === key);
        return (
          <div className="sfan-form">
            <p className="sfan-gloss">
              <b>{t?.word}</b> — {t?.gloss}
            </p>
            <div className="sfan-actions">
              <button type="button" className="sfan-primary" onClick={() => toast("Mock: would open the entry to edit")}>
                Edit
              </button>
              <button type="button" className="sfan-quiet" onClick={() => visit({ kind: "word", title: t?.word ?? "", path: `/dictionary#${t?.word.toLowerCase()}` })}>
                Open in dictionary
              </button>
            </div>
          </div>
        );
      },
      subTitle: (key) => (key === "options" ? "Entry options" : key.replace("word:", "")),
    },
    {
      id: "new",
      label: "New",
      icon: "＋",
      hint: "3 kinds",
      title: "New",
      panel: (api) => (
        <>
          <Row sub current={api.sub === "thread"} meta="post in a board" onClick={() => api.openSub("thread")}>
            Thread
          </Row>
          <Row sub current={api.sub === "topic"} meta="proposed, reviewed" onClick={() => api.openSub("topic")}>
            Topic
          </Row>
          <Row sub current={api.sub === "category"} meta="owners, guides" onClick={() => api.openSub("category")}>
            Category
          </Row>
          <div className="sfan-sep" />
          <Row onClick={() => visit({ kind: "wiki", title: "New page", path: "/wiki/new" })}>Wiki page</Row>
          <Row onClick={() => toast("Mock: would open /draw/new")}>Drawing</Row>
        </>
      ),
      sub: (key) => <NewForm key={key} kind={key} toast={toast} />,
      subTitle: (key) => ({ thread: "New thread", topic: "Propose a topic", category: "New category" })[key] ?? key,
    },
    {
      id: "publish",
      label: "Publish",
      icon: "↗",
      hint: `${DRAFTS.length} drafts`,
      title: "Publish a draft",
      panel: (api) => (
        <>
          {DRAFTS.map((d) => (
            <Row key={d.id} sub current={api.sub === d.id} meta={`${d.kind} · ${d.edited}`} onClick={() => api.openSub(d.id)}>
              {d.title}
            </Row>
          ))}
          <div className="sfan-sep" />
          <Row onClick={() => toast("Mock: would open arts-collective /studio")}>Write something new in Studio ↗</Row>
          <Route>{ROUTES.publish}</Route>
        </>
      ),
      sub: (key) => <PublishSettings key={key} id={key} toast={toast} />,
      subTitle: () => "Where and to whom",
    },
    {
      id: "recent",
      label: "Recently",
      icon: "↺",
      hint: "visited",
      title: "Recently visited",
      panel: (api) => (
        <>
          {recent.length ? (
            recent.map((r) => (
              <Row key={r.path} meta={`${r.kind} · ${r.when}`} onClick={() => visit(r)}>
                {r.title}
              </Row>
            ))
          ) : (
            <p className="sfan-empty">Nothing yet.</p>
          )}
          <div className="sfan-sep" />
          <Row sub current={api.sub === "settings"} onClick={() => api.openSub("settings")}>
            Settings
          </Row>
          <Route>{ROUTES.recent}</Route>
        </>
      ),
      sub: () => <RecentSettings remember={remember} setRemember={setRemember} clear={() => setRecent([])} />,
      subTitle: () => "Recently: settings",
    },
  ];
  if (goTo)
    tabs.push({
      id: "goto",
      label: "Go to",
      icon: "⌕",
      hint: "jump",
      title: "Go to",
      panel: () => <GoTo visit={visit} />,
    });
  return tabs;
}

