"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SHARED_BLOCKS } from "@elkdonis/blocks";
import {
  CONTRAST_CHECKS,
  PALETTE_ROLES,
  contrast,
  effectiveColour,
  type Palette,
  type PaletteRole,
  type RoleGroup,
} from "@/lib/theme";
import {
  CAPTION_SIZES,
  CAPTION_STYLES,
  FONTS,
  NAV_CASES,
  NAV_SIZES,
  NAV_TRACKINGS,
  NAV_WEIGHTS,
  TYPE_DEFAULTS,
  fontsHrefFor,
  type SiteFonts,
} from "@/lib/fonts";
import { applyThemeToDocument, clearThemeFromDocument, themePreviewVars } from "@/lib/theme-preview";
import type { NavItem } from "@/lib/navigation";

// ============================================================================
// The theme, one component at a time.
//
// Each tab is a PART of her site — the menu, a page, captions — with the
// controls that change it beside a preview of it drawn by the site's own CSS
// (`.side-nav-link`, `.page-title`, the shared blocks' own components). The
// preview wears the draft through inline variables, so nothing is saved until
// Save is pressed. "Live page" loads a real page of the site in a frame and
// puts the draft on it, which is the final word on what a visitor will see.
//
// Two mounts: /studio/theme (mode "page"), and the Puck editor's Theme tab
// (mode "rail"), where the editor's own canvas is the live page — `onDraft`
// hands the draft up so the editor can put it on the canvas.
// ============================================================================

type Tab = "menu" | "page" | "captions" | "live";

const TAB_LABEL: Record<Tab, string> = {
  menu: "Menu",
  page: "Pages",
  captions: "Captions",
  live: "Live page",
};

const GROUP_OF: Record<Exclude<Tab, "live">, RoleGroup> = {
  menu: "menu",
  page: "site",
  captions: "captions",
};

const SectionHeading = SHARED_BLOCKS.find((b) => b.def.id === "section-heading")!.Component as React.ComponentType<Record<string, unknown>>;
const Figure = SHARED_BLOCKS.find((b) => b.def.id === "figure")!.Component as React.ComponentType<Record<string, unknown>>;

export interface ThemeStudioProps {
  initialPalette: Palette;
  initialFonts: SiteFonts;
  nav: NavItem[];
  /** Pages the Live tab can show. Omitted in the editor (its canvas is live). */
  pages?: Array<{ label: string; href: string }>;
  mode?: "page" | "rail";
  onSave: (palette: Palette, fonts: SiteFonts) => Promise<{ ok: boolean; error?: string }>;
  /** Called with every change — the editor puts the draft on its canvas. */
  onDraft?: (palette: Palette, fonts: SiteFonts) => void;
  /** What is saved, when the initial values are an unsaved draft being resumed. */
  saved?: { palette: Palette; fonts: SiteFonts };
  /** Called after a successful save. */
  onSaved?: (palette: Palette, fonts: SiteFonts) => void;
}

export function ThemeStudio({
  initialPalette,
  initialFonts,
  nav,
  pages,
  mode = "page",
  onSave,
  onDraft,
  saved: savedProp,
  onSaved,
}: ThemeStudioProps) {
  const [saved, setSaved] = useState(savedProp ?? { palette: initialPalette, fonts: initialFonts });
  const [palette, setPalette] = useState<Palette>(initialPalette);
  const [fonts, setFonts] = useState<SiteFonts>(initialFonts);
  const [tab, setTab] = useState<Tab>("menu");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(palette) !== JSON.stringify(saved.palette) || JSON.stringify(fonts) !== JSON.stringify(saved.fonts);

  useEffect(() => {
    onDraft?.(palette, fonts);
  }, [palette, fonts, onDraft]);

  const tabs: Tab[] = mode === "rail" || !pages?.length ? ["menu", "page", "captions"] : ["menu", "page", "captions", "live"];
  const vars = useMemo(() => themePreviewVars(palette, fonts) as CSSProperties, [palette, fonts]);
  const fontsHref = fontsHrefFor(fonts);

  const setColour = (key: string, value: string | undefined) =>
    setPalette((p) => {
      const next = { ...p };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });

  const setFont = <K extends keyof SiteFonts>(key: K, value: SiteFonts[K] | undefined) =>
    setFonts((f) => {
      const next = { ...f };
      if (value === undefined || value === "") delete next[key];
      else next[key] = value;
      return next;
    });

  async function save() {
    setSaving(true);
    setStatus(null);
    const res = await onSave(palette, fonts);
    setSaving(false);
    if (res.ok) {
      setSaved({ palette, fonts });
      onSaved?.(palette, fonts);
      setStatus(mode === "rail" ? "Saved — every page uses it now." : "Saved. Every page uses it now.");
    } else {
      setStatus(res.error ?? "Could not save.");
    }
  }

  const group = tab === "live" ? null : GROUP_OF[tab];

  return (
    <div className="dm-ts" data-mode={mode}>
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}

      <div className="dm-hud dm-ts-tabs" role="tablist" aria-label="Part of the site">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="dm-ts-body">
        <div className="dm-hud dm-ts-controls">
          {tab === "live" ? (
            <LiveControls palette={palette} setColour={setColour} />
          ) : (
            <>
              <h3>Colours</h3>
              {PALETTE_ROLES.filter((r) => r.group === group).map((role) => (
                <ColourField key={role.key} role={role} palette={palette} onChange={setColour} />
              ))}
              <h3 style={{ marginTop: 14 }}>Type</h3>
              {tab === "menu" ? <MenuType fonts={fonts} setFont={setFont} /> : null}
              {tab === "page" ? <PageType fonts={fonts} setFont={setFont} /> : null}
              {tab === "captions" ? <CaptionType fonts={fonts} setFont={setFont} /> : null}
              <Contrast palette={palette} group={group!} />
            </>
          )}

          <div className="dm-ts-save">
            <button type="button" className="dm-hud-primary" onClick={save} disabled={saving || !dirty}>
              {saving ? "Saving…" : dirty ? "Save theme" : "Saved"}
            </button>
            <button
              type="button"
              disabled={!dirty}
              onClick={() => {
                setPalette(saved.palette);
                setFonts(saved.fonts);
                setStatus(null);
              }}
            >
              Undo changes
            </button>
            <button
              type="button"
              title="Every colour and font back to her original site's"
              onClick={() => {
                setPalette({});
                setFonts({});
                setStatus("Her originals — press Save to keep them.");
              }}
            >
              Her originals
            </button>
          </div>
          {status ? <p className="dm-hud-muted" role="status">{status}</p> : dirty ? <p className="dm-hud-muted">Not saved yet — only this preview has changed.</p> : null}
        </div>

        <div className="dm-ts-preview">
          {tab === "live" && pages?.length ? (
            <LivePreview pages={pages} palette={palette} fonts={fonts} />
          ) : (
            <div className="dm-ts-stage" style={vars}>
              {tab === "menu" ? <MenuPreview nav={nav} compact={mode === "rail"} /> : null}
              {tab === "page" ? <PagePreview /> : null}
              {tab === "captions" ? <CaptionsPreview compact={mode === "rail"} /> : null}
            </div>
          )}
          {mode === "rail" && tab === "page" ? (
            <p className="dm-hud-muted" style={{ marginTop: 6 }}>
              The page in the canvas is wearing these changes too.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function labelOf(key: string) {
  return PALETTE_ROLES.find((r) => r.key === key)?.label ?? key;
}

function ColourField({
  role,
  palette,
  onChange,
}: {
  role: PaletteRole;
  palette: Palette;
  onChange: (key: string, value: string | undefined) => void;
}) {
  const own = palette[role.key];
  const effective = effectiveColour(palette, role.key);
  const following = Boolean(role.follows) && !own;
  return (
    <div className="dm-ts-field">
      <div className="dm-hud-spread">
        <span className="dm-ts-label">{role.label}</span>
        {following ? <span className="dm-hud-chip">same as {labelOf(role.follows!)}</span> : null}
      </div>
      <span className="dm-hud-muted">{role.hint}</span>
      <div className="dm-hud-row" style={{ flexWrap: "nowrap" }}>
        <input
          type="color"
          value={effective}
          onChange={(e) => onChange(role.key, e.target.value)}
          aria-label={role.label}
          className="dm-ts-swatch"
        />
        {/* Typed as well as picked: a brand colour arrives as a hex code. */}
        <input
          type="text"
          value={own ?? effective}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(role.key, v);
          }}
          spellCheck={false}
          aria-label={`${role.label}, hex code`}
          style={{ fontFamily: "ui-monospace, Menlo, monospace", width: "7.5em", flex: "none" }}
        />
        {role.follows && own ? (
          <button type="button" onClick={() => onChange(role.key, undefined)} title={`Go back to following ${labelOf(role.follows)}`}>
            Follow {labelOf(role.follows).toLowerCase()}
          </button>
        ) : null}
        {!role.follows && own && own !== role.fallback ? (
          <button type="button" onClick={() => onChange(role.key, undefined)} title={`Her original, ${role.fallback}`}>
            Hers
          </button>
        ) : null}
      </div>
    </div>
  );
}

type SetFont = <K extends keyof SiteFonts>(key: K, value: SiteFonts[K] | undefined) => void;

function Choice<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
  empty,
}: {
  label: string;
  hint?: string;
  value: T | undefined;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T | undefined) => void;
  /** An "unset" option, when unset means something (e.g. "same as body"). */
  empty?: string;
}) {
  return (
    <label className="dm-ts-field">
      <span className="dm-ts-label">{label}</span>
      {hint ? <span className="dm-hud-muted">{hint}</span> : null}
      <select
        value={value === undefined ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(undefined);
          const hit = options.find((o) => String(o.value) === raw);
          onChange(hit?.value);
        }}
      >
        {empty !== undefined ? <option value="">{empty}</option> : null}
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const FONT_OPTIONS = FONTS.map((f) => ({ value: f.id, label: f.label }));

function MenuType({ fonts, setFont }: { fonts: SiteFonts; setFont: SetFont }) {
  return (
    <>
      <Choice label="Menu font" value={fonts.nav} options={FONT_OPTIONS} empty="Same as body text" onChange={(v) => setFont("nav", v)} />
      <div className="dm-ts-pair">
        <Choice
          label="Weight"
          value={fonts.navWeight ?? TYPE_DEFAULTS.navWeight}
          options={NAV_WEIGHTS.map((w) => ({ value: w.value as number, label: w.label }))}
          onChange={(v) => setFont("navWeight", v)}
        />
        <Choice
          label="Size"
          value={fonts.navSize ?? TYPE_DEFAULTS.navSize}
          options={NAV_SIZES.map((w) => ({ value: w.value as number, label: w.label }))}
          onChange={(v) => setFont("navSize", v)}
        />
      </div>
      <div className="dm-ts-pair">
        <Choice
          label="Letters"
          value={fonts.navCase ?? TYPE_DEFAULTS.navCase}
          options={NAV_CASES.map((w) => ({ value: w.value as string, label: w.label }))}
          onChange={(v) => setFont("navCase", v as SiteFonts["navCase"])}
        />
        <Choice
          label="Spacing"
          value={fonts.navTracking ?? TYPE_DEFAULTS.navTracking}
          options={NAV_TRACKINGS.map((w) => ({ value: w.value as number, label: w.label }))}
          onChange={(v) => setFont("navTracking", v)}
        />
      </div>
      <p className="dm-hud-muted">
        The menu&rsquo;s titles and order are under <a href="/studio/navigation">Navigation</a> (or the editor&rsquo;s Menu tab).
      </p>
    </>
  );
}

function PageType({ fonts, setFont }: { fonts: SiteFonts; setFont: SetFont }) {
  return (
    <>
      <Choice label="Headings" hint="Page titles, block headings, the name on the landing." value={fonts.heading} options={FONT_OPTIONS} empty="Same as body text" onChange={(v) => setFont("heading", v)} />
      <Choice label="Body text" hint="Running text and labels." value={fonts.body} options={FONT_OPTIONS} empty="Her original (Helvetica)" onChange={(v) => setFont("body", v)} />
      <Choice label="Blog reading" hint="Her writing on /blog." value={fonts.reading} options={FONT_OPTIONS} empty="The reader's own (Garamond)" onChange={(v) => setFont("reading", v)} />
      <p className="dm-hud-muted">One page can use its own body and heading fonts: open it in the editor, click the page background, Page settings.</p>
    </>
  );
}

function CaptionType({ fonts, setFont }: { fonts: SiteFonts; setFont: SetFont }) {
  return (
    <>
      <Choice label="Caption font" hint="Under pictures, artwork labels, subtitles." value={fonts.caption} options={FONT_OPTIONS} empty="Same as body text" onChange={(v) => setFont("caption", v)} />
      <div className="dm-ts-pair">
        <Choice
          label="Size"
          value={fonts.captionSize}
          options={CAPTION_SIZES.map((w) => ({ value: w.value as number, label: w.label }))}
          empty="Each its own"
          onChange={(v) => setFont("captionSize", v)}
        />
        <Choice
          label="Slant"
          value={fonts.captionStyle}
          options={CAPTION_STYLES.map((w) => ({ value: w.value as string, label: w.label }))}
          empty="Each its own"
          onChange={(v) => setFont("captionStyle", v as SiteFonts["captionStyle"])}
        />
      </div>
    </>
  );
}

function Contrast({ palette, group }: { palette: Palette; group: RoleGroup }) {
  const rows = CONTRAST_CHECKS.filter((c) => c.group === group).map((c) => {
    const ratio = contrast(effectiveColour(palette, c.fg), effectiveColour(palette, c.bg));
    return { ...c, ratio, passes: ratio >= c.min };
  });
  const failing = rows.filter((r) => !r.passes).length;
  return (
    <details className="dm-ts-contrast" open={failing > 0}>
      <summary>
        Readability — {failing ? `${failing} below the line` : "all clear"}
      </summary>
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>
                {r.label}
                {r.note ? <span className="dm-hud-muted"> · {r.note}</span> : null}
              </td>
              <td className="dm-ts-num">{r.ratio.toFixed(2)}</td>
              {/* The word carries the verdict, never colour alone. */}
              <td className="dm-ts-verdict" data-pass={r.passes ? "true" : "false"}>
                {r.passes ? "passes" : `under ${r.min}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dm-hud-muted">WCAG: 4.5 for text, 3 for marks and large text.</p>
    </details>
  );
}

/** The Live tab edits the site-wide colours, the ones a whole page shows. */
function LiveControls({ palette, setColour }: { palette: Palette; setColour: (k: string, v: string | undefined) => void }) {
  return (
    <>
      <h3>Colours</h3>
      {PALETTE_ROLES.filter((r) => r.group === "site").map((role) => (
        <ColourField key={role.key} role={role} palette={palette} onChange={setColour} />
      ))}
      <p className="dm-hud-muted">The menu, captions and fonts are on their own tabs; what you choose there shows here too.</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Previews — the site's own classes, wearing the draft.
// ---------------------------------------------------------------------------

function Caption({ children }: { children: ReactNode }) {
  return <p className="dm-ts-caption">{children}</p>;
}

function MenuPreview({ nav, compact }: { nav: NavItem[]; compact?: boolean }) {
  const items = nav.length ? nav : [{ label: "Collections", href: "/collections" }];
  // The first on-site link plays "the page you are on", the next "pointed at".
  const active = Math.max(0, items.findIndex((i) => !i.external));
  const hover = items.findIndex((i, n) => n > active && !i.external);
  const links = (phone: boolean) =>
    items.map((item, i) => (
      <span
        key={`${item.href}-${i}`}
        className={i === active ? "side-nav-link is-active" : "side-nav-link"}
        data-preview-hover={i === hover ? "" : undefined}
        style={phone ? { fontSize: "max(var(--dm-nav-size), 0.85rem)", padding: "0.35rem 0" } : undefined}
      >
        {item.label}
      </span>
    ));

  return (
    <div className="dm-ts-menu">
      <figure className="dm-ts-frame">
        <div className="dm-ts-sidebar">
          <span className="brand-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-uranus.png" alt="" width={150} height={136} />
          </span>
          <div className="side-nav">{links(false)}</div>
        </div>
        <Caption>Beside every page</Caption>
      </figure>
      {!compact ? (
        <figure className="dm-ts-frame">
          <div className="dm-ts-drawer">
            <div className="side-nav">{links(true)}</div>
          </div>
          <Caption>On a phone, the menu drawer</Caption>
        </figure>
      ) : null}
      <p className="dm-ts-key">
        <strong>{items[active]?.label}</strong> is shown as the page you are on
        {hover >= 0 ? (
          <>
            , <strong>{items[hover]?.label}</strong> as pointed at
          </>
        ) : null}
        .
      </p>
    </div>
  );
}

function PagePreview() {
  return (
    <div className="dm-ts-page">
      <h1 className="page-title">Medicine Buddha Invocation</h1>
      <SectionHeading
        eyebrow="Collection"
        title="Universal Pharmacy"
        subtitle="Resin, pills and acrylic — a mandala of the medicines we live by."
        level="h2"
        align="start"
        rule
      />
      <p>
        As a surrealist, one contemplates the liminal threshold(s) of multidimensional reality — running text as it is set on
        every page, with <a href="#preview" onClick={(e) => e.preventDefault()}>a link in the text</a>.
      </p>
      <p className="dm-ts-buttons">
        <span className="button-secondary">A plain button</span>
        <span className="dm-ts-fill">On the highlight</span>
        <span className="dm-ts-mark">sold</span>
      </p>
      <div className="dm-ts-reading">
        <p>Her writing on /blog reads in its own face — a long paragraph set for reading, with <em>italics</em> where she wants them.</p>
      </div>
    </div>
  );
}

function CaptionsPreview({ compact }: { compact?: boolean }) {
  return (
    <div className="dm-ts-captions">
      <div className="dm-ts-caption-grid">
        <figure className="dm-ts-frame">
          <Figure src="/images/medicine-buddha.jpg" alt="" caption="Medicine Buddha — oil on canvas" width="measure" />
          <Caption>A picture block&rsquo;s caption</Caption>
        </figure>
        <figure className="dm-ts-frame">
          <div className="dm-work">
            <div className="dm-work-picture">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/solar-absolute.jpg" alt="" />
            </div>
            <div className="dm-work-label">
              <p className="dm-work-title">
                <cite>Solar Absolute</cite>
                <span>, 2018</span>
              </p>
              <p className="dm-work-meta">Oil on panel · 60 × 60 cm</p>
            </div>
          </div>
          <Caption>An artwork&rsquo;s label</Caption>
        </figure>
      </div>
      {!compact ? (
        <figure className="dm-ts-frame">
          <div className="dm-ts-dark">
            <div className="dm-set-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/law-of-three.jpg" alt="" />
              <figcaption>Law of Three</figcaption>
            </div>
          </div>
          <Caption>Full size, from a picture set — the caption keeps its light ink on the dark</Caption>
        </figure>
      ) : null}
    </div>
  );
}

function LivePreview({
  pages,
  palette,
  fonts,
}: {
  pages: Array<{ label: string; href: string }>;
  palette: Palette;
  fonts: SiteFonts;
}) {
  // The second entry when there is one: the landing hides the menu, which is
  // usually the thing being judged.
  const [href, setHref] = useState((pages[1] ?? pages[0])!.href);
  const [width, setWidth] = useState(1280);
  const [box, setBox] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const draft = useRef({ palette, fonts });
  draft.current = { palette, fonts };

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBox(entry!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const apply = () => {
    const doc = frame.current?.contentDocument;
    if (doc?.documentElement) applyThemeToDocument(doc, draft.current.palette, draft.current.fonts);
  };
  useEffect(apply, [palette, fonts]);
  useEffect(
    () => () => {
      const doc = frame.current?.contentDocument;
      if (doc) clearThemeFromDocument(doc);
    },
    []
  );

  const scale = box ? Math.min(1, box / width) : 0.5;
  const height = 820;

  return (
    <div className="dm-ts-live">
      <div className="dm-hud dm-hud-row">
        <select value={href} onChange={(e) => setHref(e.target.value)} aria-label="Page to preview" style={{ flex: 1, width: "auto" }}>
          {pages.map((p) => (
            <option key={p.href} value={p.href}>
              {p.label} — {p.href}
            </option>
          ))}
        </select>
        <select value={String(width)} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Screen size" style={{ width: "auto" }}>
          <option value="1280">Desktop</option>
          <option value="820">Tablet</option>
          <option value="390">Phone</option>
        </select>
      </div>
      <div ref={wrap} className="dm-ts-live-box" style={{ height: height * scale }}>
        <iframe
          ref={frame}
          key={href}
          src={href}
          title="The page, wearing the draft theme"
          onLoad={apply}
          style={{ width, height, transform: `scale(${scale})`, ...(width < box ? { marginLeft: (box - width * scale) / 2 } : {}) }}
        />
      </div>
      <p className="dm-hud-muted">The real page, drawn by the site itself. Links work inside it; the draft stays on as you move around.</p>
    </div>
  );
}
