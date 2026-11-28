"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceFrame, useSurface } from "@elkdonis/cms-ui/surface";
import { TEMPLATES, type TemplateId } from "@elkdonis/cms-ui/offer-templates/types";
import "@elkdonis/cms-ui/offer-surface.css";
import { setOfferFeaturedAction, setOfferTemplateAction } from "@/lib/offer-featured-actions";
import { saveOfferLookAction } from "@/lib/offer-look-actions";
import { loadCurrentWorkAction } from "@/lib/offer-card-actions";
import { templatesFor } from "@/lib/offer-load/keys";
import { KIND_WORD, type CurrentWorkData } from "@/lib/offer-card-types";
import { CURRENT_WORK_SURFACES } from "./current-work-keys";
import "./current-work.css";

const FONTS = ["para", "gazette", "quiet", "marquee", "ledger", "rite"] as const;
const ICONS = ["things", "marks", "stamps", "glyph"] as const;
const MARKS = ["inline", "thumb", "box"] as const;
const SHEETS = ["natural", "level"] as const;

/**
 * The fonts of the "para" font template, from cms-ui offer-surface/fonts.ts (same families and weights).
 * Not imported from there: the package has no subpath for it, and its index would pull every offer layer
 * into the hub's client bundle. The body is always drawn in para; the site's own font template is only a setting.
 */
const BODY_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400;1,9..144,600&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One look setting: its name, a one-line plain explanation, and a joined row of square choices. */
function Opts<T extends string>({
  label,
  note,
  value,
  options,
  disabled,
  onPick,
}: {
  label: string;
  note: string;
  value: T;
  options: readonly { id: T; text: string }[];
  disabled: boolean;
  onPick: (v: T) => void;
}) {
  return (
    <div className="cwp-group" role="group" aria-label={label}>
      <span className="cwp-group-label">{label}</span>
      <p className="cwp-group-note">{note}</p>
      <div className="cwp-opts">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`cwp-opt${value === o.id ? " is-on" : ""}`}
            aria-pressed={value === o.id}
            disabled={disabled}
            onClick={() => value !== o.id && onPick(o.id)}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { id: "page", label: "Page" },
  { id: "theme", label: "Theme settings" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * A small tab strip in the kit's language (the shared SurfaceFrame has no tabs): square, a bronze rule under
 * the active tab, one tab stop, Left/Right/Home/End move and select. The panels are cheap, so selecting on
 * focus is fine.
 */
function Tabs({ tab, onTab, base }: { tab: TabId; onTab: (t: TabId) => void; base: string }) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  function move(i: number) {
    const next = TABS[(i + TABS.length) % TABS.length];
    onTab(next.id);
    refs.current[next.id]?.focus();
  }
  return (
    <div className="cwp-tabs" role="tablist" aria-label="Current Work Page">
      {TABS.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          type="button"
          role="tab"
          id={`${base}-tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`${base}-panel-${t.id}`}
          tabIndex={tab === t.id ? 0 : -1}
          className="cwp-tab"
          onClick={() => onTab(t.id)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              move(i + 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              move(i - 1);
            } else if (e.key === "Home") {
              e.preventDefault();
              move(0);
            } else if (e.key === "End") {
              e.preventDefault();
              move(TABS.length - 1);
            }
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The Current Work Page card's surface, in two tabs.
 *  - Page (first): the switch for the new page, what leads it (Change opens the content library as a picker
 *    layer) and the template for that piece: what an owner comes here to do.
 *  - Theme settings: everything about look (font template, icons, kind colour, phone head mark, phone sheet),
 *    each with a one-line explanation.
 * Every control saves at once (Decision 7), through the gated actions: setOfferFeaturedAction,
 * setOfferTemplateAction, saveOfferLookAction. Drawn in the offer kit's dark look (see current-work.css).
 */
export function CurrentWorkSurface({
  data,
  note,
  onChange,
}: {
  data: CurrentWorkData;
  /** A line from another layer (the picker saved something). */
  note: string | null;
  onChange: (data: CurrentWorkData | null, note: string | null) => void;
}) {
  const surface = useSurface();
  const router = useRouter();
  const base = React.useId();
  const [tab, setTab] = React.useState<TabId>("page");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

  const f = data.featured;
  const options = f ? templatesFor(f.kind) : [];
  const templates = options.map((id) => TEMPLATES.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const status = busy ? "Saving…" : error ?? saved ?? note ?? undefined;

  /** Run one save; on success re-read the card's data so every part shows what the site now does. */
  async function run(optimistic: CurrentWorkData | null, save: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    if (optimistic) onChange(optimistic, null);
    const r = await save();
    if (r.ok === false) {
      setError(r.error ?? "Could not save.");
      onChange(data, null);
      setBusy(false);
      return;
    }
    const fresh = await loadCurrentWorkAction(data.orgSlug);
    onChange(fresh.ok ? fresh.data : optimistic, null);
    setSaved(`Saved. ${done}`);
    router.refresh();
    setBusy(false);
  }

  const saveLook = (patch: Partial<CurrentWorkData["look"]>, done: string) => {
    const look = { ...data.look, ...patch };
    return run({ ...data, look }, () => saveOfferLookAction(data.orgSlug, { ...look, enabled: data.enabled }), done);
  };

  const how = !f
    ? ""
    : f.chosen
      ? "You chose this piece."
      : "Chosen automatically: the pinned piece, else the newest public one.";

  return (
    <SurfaceFrame
      kind="gallery"
      kicker="Your site"
      title="Current Work Page"
      status={status}
      statusTone={error ? "error" : "normal"}
      actions={[{ label: "View the site", href: data.siteUrl, external: true, primary: true }]}
      flush
    >
      <link rel="stylesheet" href={BODY_FONTS_HREF} precedence="default" />
      <div className="osf-root eac-offer cwp cwp-dark" data-ft="para" data-tint={data.look.tint ? undefined : "off"}>
        <Tabs tab={tab} onTab={setTab} base={base} />

        {/* ── Tab one: the page ── */}
        <div
          className="cwp-panel"
          role="tabpanel"
          id={`${base}-panel-page`}
          aria-labelledby={`${base}-tab-page`}
          hidden={tab !== "page"}
        >
          <p className="osf-note">Changes show on your site straight away.</p>

          {/* The page itself: on or off. */}
          <section className="cwp-sec" aria-label="The new page">
            <label className="cwp-switch">
              <input
                type="checkbox"
                checked={data.enabled}
                disabled={busy}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  void run(
                    { ...data, enabled },
                    () => saveOfferLookAction(data.orgSlug, { ...data.look, enabled }),
                    enabled ? "Your site now shows the new page." : "The new page is off."
                  );
                }}
              />
              <span className="cwp-track" aria-hidden />
              <span className="cwp-switch-text">
                <strong>Use the new page</strong>
                <span className="osf-note">
                  {data.enabled
                    ? "Your site shows the page below."
                    : `Off. Your site shows ${data.drawsInstead}. Turn this on to show the new page instead.`}
                </span>
              </span>
            </label>
          </section>

          {/* What leads the page. */}
          <section className="cwp-sec" aria-label="What leads the page">
            <h3 className="osf-label">What leads the page</h3>
            {f ? (
              <div className="cwp-current">
                {f.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cwp-pic" src={f.cover} alt="" />
                ) : (
                  <span className="cwp-pic" aria-hidden />
                )}
                <span className="cwp-current-text">
                  <span className="cwp-current-kind">{KIND_WORD[f.kind]}</span>
                  <span className="cwp-current-title">{f.title}</span>
                  <span className="cwp-current-how">{how}</span>
                </span>
              </div>
            ) : (
              <p className="osf-note">
                Nothing is public yet. Publish an event, service, series, piece of writing or artwork and it can lead the page.
              </p>
            )}
            <div className="cwp-btns">
              <button
                type="button"
                className="osf-btn osf-btn-primary"
                disabled={busy}
                onClick={() =>
                  surface.push({ type: "custom", key: CURRENT_WORK_SURFACES.pick, title: "Choose what leads your page", kind: "gallery", size: "wide" })
                }
              >
                Change
              </button>
              {f?.chosen && (
                <button
                  type="button"
                  className="osf-btn osf-btn-quiet"
                  disabled={busy}
                  onClick={() => void run(null, () => setOfferFeaturedAction(data.orgSlug, null), "Your page now picks automatically.")}
                >
                  Use the automatic choice
                </button>
              )}
            </div>
          </section>

          {/* Template. */}
          {f && (
            <section className="cwp-sec" aria-label="Template">
              <h3 className="osf-label">Template</h3>
              {templates.length > 1 ? (
                <>
                  <p className="osf-note">How this {KIND_WORD[f.kind].toLowerCase()} is laid out. Each piece keeps its own.</p>
                  <div className="osf-group" role="radiogroup" aria-label="Template">
                    {templates.map((t) => {
                      const on = t.id === f.template;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={busy}
                          className={`osf-radio cwp-tpl${on ? " is-on" : ""}`}
                          onClick={() => {
                            if (on) return;
                            void run(
                              { ...data, featured: { ...f, template: t.id as TemplateId } },
                              () => setOfferTemplateAction(data.orgSlug, f.key, t.id),
                              `The page now uses ${t.name}.`
                            );
                          }}
                        >
                          <span className="osf-dot" aria-hidden />
                          <span className="osf-radio-text">
                            <span className="cwp-tpl-name">{t.name}</span>
                            <span className="cwp-tpl-blurb">{t.blurb}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                templates[0] && (
                  <>
                    <div className="osf-radio is-on cwp-tpl" aria-disabled="true">
                      <span className="osf-dot" aria-hidden />
                      <span className="osf-radio-text">
                        <span className="cwp-tpl-name">{templates[0].name}</span>
                        <span className="cwp-tpl-blurb">{templates[0].blurb}</span>
                      </span>
                    </div>
                    <p className="osf-note">
                      A {KIND_WORD[f.kind].toLowerCase()} has one template, so there is nothing to choose. Events and writing have more.
                    </p>
                  </>
                )
              )}
            </section>
          )}
        </div>

        {/* ── Tab two: Theme settings (everything about look, nothing else) ── */}
        <div
          className="cwp-panel cwp-theme"
          role="tabpanel"
          id={`${base}-panel-theme`}
          aria-labelledby={`${base}-tab-theme`}
          hidden={tab !== "theme"}
        >
          <p className="osf-note">How your whole page looks. These apply to every piece, whichever one leads the page.</p>
          <Opts
            label="Font template"
            note="The set of typefaces the page is written in."
            value={data.look.font}
            options={FONTS.map((id) => ({ id, text: cap(id) }))}
            disabled={busy}
            onPick={(font) => void saveLook({ font }, `The font template is ${cap(font)}.`)}
          />
          <Opts
            label="Icons"
            note="The style of the small icons on the page."
            value={data.look.icons}
            options={ICONS.map((id) => ({ id, text: cap(id) }))}
            disabled={busy}
            onPick={(icons) => void saveLook({ icons }, `The icons are ${cap(icons)}.`)}
          />
          <Opts
            label="Colour for each kind of piece"
            note="On: events, services, series, artworks and writing each have their own colour. Off: all use one."
            value={data.look.tint ? "on" : "off"}
            options={[
              { id: "on", text: "On" },
              { id: "off", text: "Off" },
            ]}
            disabled={busy}
            onPick={(v) => void saveLook({ tint: v === "on" }, v === "on" ? "Each kind has its own colour." : "All kinds use one colour.")}
          />
          <Opts
            label="Phone head mark"
            note="On a phone, how the mark beside each popup's title is drawn."
            value={data.look.mark}
            options={MARKS.map((id) => ({ id, text: cap(id) }))}
            disabled={busy}
            onPick={(mark) => void saveLook({ mark }, `The phone head mark is ${cap(mark)}.`)}
          />
          <Opts
            label="Phone sheet"
            note="Natural: each sheet takes the height it needs. Level: every sheet is the same height."
            value={data.look.sheet}
            options={SHEETS.map((id) => ({ id, text: cap(id) }))}
            disabled={busy}
            onPick={(sheet) => void saveLook({ sheet }, `The phone sheet is ${cap(sheet)}.`)}
          />
        </div>

        {error && (
          <p className="cwp-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </SurfaceFrame>
  );
}
