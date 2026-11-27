"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AMRIT_FIFTH,
  FIXED_RED_INDEX,
  NOTES,
  ROLE_JOB,
  ROLE_LABEL,
  ROLE_ORDER,
  SHADES,
  SITES,
  TEXT_STYLES,
  TONES,
  type RoleKey,
  type Shade,
  type SiteId,
  type SiteState,
  type Tone,
} from "./data";
import { cleanHex, ratio, resolve, roleVars, shadeLabel, type RoleSet } from "./theme";
import { onColor } from "./gradients";
import "./five-colour-theme.css";

// ============================================================================
// A theme from five colours (Manjushri, 2026-11-22): a sandbox for the proposal in
// docs/open/THEME_SYSTEM_2026-11-22/STRUCTURE.md. Five colours -> nine shades each -> eleven roles (pointers) ->
// four tones. The specimen is drawn only with role variables, so editing one colour restyles the whole page.
// The state is kept in this browser's localStorage and nothing is written to any site.
// ============================================================================

const KEY = "eac-five-colour-theme-v1";
type All = { site: SiteId; sites: Record<SiteId, SiteState> };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const fresh = (): All => ({ site: "elkdonis", sites: { elkdonis: clone(SITES.elkdonis.start), amrit: clone(SITES.amrit.start) } });

/** Merge what was kept over the proposal, accepting only values that make sense. */
function revive(raw: unknown): All {
  const base = fresh();
  try {
    const r = raw as Partial<All> | null;
    if (!r || typeof r !== "object") return base;
    if (r.site === "elkdonis" || r.site === "amrit") base.site = r.site;
    for (const id of ["elkdonis", "amrit"] as SiteId[]) {
      const s = r.sites?.[id] as Partial<SiteState> | undefined;
      if (!s) continue;
      const b = base.sites[id];
      if (Array.isArray(s.colours)) s.colours.slice(0, 5).forEach((c, i) => { const h = typeof c === "string" ? cleanHex(c) : null; if (h) b.colours[i] = h; });
      if (s.fifth === "orange" || s.fifth === "warm") b.fifth = s.fifth;
      if (s.pointers) {
        for (const k of ROLE_ORDER) {
          const p = s.pointers[k];
          if (Array.isArray(p) && Number.isInteger(p[0]) && p[0] >= 0 && p[0] <= FIXED_RED_INDEX && (SHADES as number[]).includes(p[1])) b.pointers[k] = [p[0], p[1] as Shade];
        }
      }
      if (s.tones) for (const d of SITES[id].sections) { const t = s.tones[d.key]; if ((TONES as string[]).includes(t)) b.tones[d.key] = t as Tone; }
    }
  } catch {
    return fresh();
  }
  return base;
}

// ---- pins ------------------------------------------------------------------------------------------------------------

const PinCtx = createContext<{ on: boolean; open: string[]; toggle: (id: string) => void }>({ on: true, open: [], toggle: () => {} });
const noteOf = (id: string) => NOTES.find((n) => n.id === id)!;

function Pin({ id }: { id: string }) {
  const { on, open, toggle } = useContext(PinCtx);
  if (!on) return null;
  const isOpen = open.includes(id);
  return (
    <button type="button" className="fct-pin" aria-expanded={isOpen} aria-controls={`note-${id}`} aria-label={`Note ${id}: ${noteOf(id).where}`} onClick={() => toggle(id)} data-pin={id}>
      <span>{id}</span>
    </button>
  );
}
function PinNote({ id }: { id: string }) {
  const { on, open } = useContext(PinCtx);
  if (!on || !open.includes(id)) return null;
  return (
    <aside className="fct-note" id={`note-${id}`} role="note" data-note={id}>
      <strong>{id}</strong> {noteOf(id).text}
    </aside>
  );
}

// ---- small controls ----------------------------------------------------------------------------------------------------

function HexField({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (cleanHex(draft) !== value) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span className="fct-hex">
      <input type="color" aria-label={`${label}, colour picker`} value={value} onChange={(e) => onChange(e.target.value.toLowerCase())} />
      <input
        type="text"
        aria-label={`${label}, hex value`}
        value={draft}
        spellCheck={false}
        autoCapitalize="off"
        onChange={(e) => {
          setDraft(e.target.value);
          const h = cleanHex(e.target.value);
          if (h) onChange(h);
        }}
        onBlur={() => setDraft(value)}
      />
    </span>
  );
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="fct-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const pass = (r: number, min: number) => r >= min;

function Head({ title, pin, children }: { title: string; pin?: string; children?: ReactNode }) {
  return (
    <>
      <div className="fct-head">
        <h2>{title}</h2>
        {pin ? <Pin id={pin} /> : null}
      </div>
      {pin ? <PinNote id={pin} /> : null}
      {children}
    </>
  );
}

// ---- the page ----------------------------------------------------------------------------------------------------------

export function FiveColourTheme() {
  const [all, setAll] = useState<All>(fresh);
  const [notes, setNotes] = useState(true);
  const [open, setOpen] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setAll(revive(p));
        if (typeof p?.notes === "boolean") setNotes(p.notes);
      }
    } catch {
      /* storage blocked or unreadable: the page works without it */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...all, notes }));
    } catch {
      /* ignore */
    }
  }, [all, notes, loaded]);

  const say = (t: string) => {
    setStatus(t);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), 4000);
  };

  const site = SITES[all.site];
  const st = all.sites[all.site];
  const R = useMemo(() => resolve(st), [st]);
  const patch = useCallback((fn: (s: SiteState) => void) => setAll((a) => { const n = clone(a); fn(n.sites[a.site]); return n; }), []);
  const toggle = useCallback((id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])), []);

  const names = all.site === "amrit" ? [...site.names.slice(0, 4), AMRIT_FIFTH[st.fifth].name] : site.names;
  const colourName = (i: number) => (i === FIXED_RED_INDEX ? "Fixed red" : names[i]);

  const back = () => {
    setAll(fresh());
    setOpen([]);
    setNotes(true);
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    say("Back to the proposal.");
  };

  const summary = () => {
    const pt = (r: RoleKey) => { const [i, s] = st.pointers[r]; return `${ROLE_LABEL[r].toLowerCase()} = ${colourName(i)}, ${shadeLabel(s)} (${R.roles[r]})`; };
    return [
      "My choices on the five-colour theme page (a sandbox: nothing here changes a site)",
      `Site: ${site.label}`,
      `Palette: ${names.map((n, i) => `${n} ${st.colours[i].toUpperCase()}`).join(", ")}`,
      all.site === "amrit" ? `Amrit's fifth colour: ${AMRIT_FIFTH[st.fifth].name}` : "",
      `Roles: ${ROLE_ORDER.map(pt).join("; ")}; on-accent = ${R.roles.onAccent} (worked out)`,
      `Tones: ${site.sections.map((d) => `${d.name} ${st.tones[d.key]}`).join(", ")}`,
      `Checks: ink on ground ${ratio(R.roles.ink, R.roles.ground).toFixed(1)}, muted ink on ground ${ratio(R.roles.muted, R.roles.ground).toFixed(1)}, on-accent on accent ${ratio(R.roles.onAccent, R.roles.accent).toFixed(1)}, deep tone ${ratio(R.tones.deep.ink, R.tones.deep.ground).toFixed(1)}`,
    ].filter(Boolean).join("\n");
  };
  const copy = async () => {
    const text = summary();
    try {
      await navigator.clipboard.writeText(text);
      say("Copied. Paste it to Manjushri.");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        say(ok ? "Copied. Paste it to Manjushri." : "Could not copy here. Select the text below and copy it.");
      } catch {
        say("Could not copy here.");
      }
    }
  };

  // ---- checks
  const checks: { label: string; a: string; b: string; pin?: string }[] = [
    { label: "Ink on ground", a: R.roles.ink, b: R.roles.ground },
    { label: "Muted ink on ground", a: R.roles.muted, b: R.roles.ground },
    { label: "On-accent on accent", a: R.roles.onAccent, b: R.roles.accent },
    { label: "Ink on soft ground", a: R.roles.ink, b: R.roles.soft },
    { label: "Deep tone: ink on its ground", a: R.tones.deep.ink, b: R.tones.deep.ground, pin: "N8" },
  ];

  const frameStyle = { ...roleVars(R.roles), "--f-title": site.fonts.titleStack, "--f-body": site.fonts.bodyStack } as CSSProperties;

  return (
    <PinCtx.Provider value={{ on: notes, open, toggle }}>
      <div className="fct" data-site={all.site}>
        <p className="fct-plain">
          A sandbox. Nothing here changes a site, and nothing is saved anywhere except in this browser, so you can come back to it. Pick a site, change a colour and watch every role, section and check below follow.
        </p>

        <div className="fct-bar" role="toolbar" aria-label="Page controls">
          <Seg<SiteId>
            label="Site"
            value={all.site}
            onChange={(v) => setAll((a) => ({ ...a, site: v }))}
            options={[
              { id: "elkdonis", label: "elkdonis-arts.org" },
              { id: "amrit", label: "Amrit Canada" },
            ]}
          />
          <button type="button" role="switch" aria-checked={notes} className="fct-switch" onClick={() => setNotes((n) => !n)}>
            <span className="fct-knob" aria-hidden />
            Notes
          </button>
          <button type="button" className="fct-btn-chrome" onClick={back}>
            Back to the proposal
          </button>
          <button type="button" className="fct-btn-chrome fct-primary" onClick={copy}>
            Copy my choices
          </button>
          <span className="fct-status" role="status" aria-live="polite">{status}</span>
        </div>

        {/* 1 Palette */}
        <Head title="Palette" pin="N1" />
        <p className="fct-sub">Five colours. This is the only place a site would keep a colour. Each shows its nine shades below, from lightest (100) to darkest (900).</p>
        <div className="fct-pigments">
          {st.colours.map((hex, i) => {
            const label = names[i];
            const ink = onColor(hex, "#ffffff", "#141414");
            return (
              <article key={i} className="fct-pigment" data-slot={i + 1}>
                <div className="fct-pig" style={{ background: hex, color: ink }}>
                  <span className="fct-pig-name">{label}</span>
                  <span className="fct-pig-hex">{hex.toUpperCase()}</span>
                </div>
                <div className="fct-pig-edit">
                  <HexField value={hex} label={label} onChange={(h) => patch((s) => { s.colours[i] = h; })} />
                </div>
                {all.site === "amrit" && i === 4 ? (
                  <div className="fct-fifth">
                    <Seg<"orange" | "warm">
                      label="Fifth colour"
                      value={st.fifth}
                      onChange={(v) => patch((s) => { s.fifth = v; s.colours[4] = AMRIT_FIFTH[v].hex; })}
                      options={[
                        { id: "orange", label: `Orange ${AMRIT_FIFTH.orange.hex}` },
                        { id: "warm", label: `Warm white ${AMRIT_FIFTH.warm.hex}` },
                      ]}
                    />
                    <Pin id="N2" />
                  </div>
                ) : null}
                <div className="fct-shades" aria-label={`${label} shades`}>
                  {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => (
                    <span key={s} className="fct-shade" title={`${label} ${s}: ${R.ramps[i][s]}`}>
                      <i style={{ background: R.ramps[i][s] }} data-shade={s} />
                      <b>{s}</b>
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        {all.site === "amrit" ? <PinNote id="N2" /> : null}

        {/* 2 Roles */}
        <Head title="Roles">
          <p className="fct-sub">A role is a job with a fixed name, the same on every site. Each points at one colour and one shade, so a role never holds a colour of its own.</p>
        </Head>
        <div className="fct-roles">
          {ROLE_ORDER.map((r) => {
            const [ci, sh] = st.pointers[r];
            return (
              <div key={r} className="fct-role" data-role={r}>
                <div className="fct-role-name">
                  <strong>{ROLE_LABEL[r]}</strong>
                  <span>{ROLE_JOB[r]}</span>
                </div>
                <div className="fct-role-point">
                  <select aria-label={`${ROLE_LABEL[r]}, colour`} value={ci} onChange={(e) => patch((s) => { s.pointers[r] = [Number(e.target.value), s.pointers[r][1]]; })}>
                    {[0, 1, 2, 3, 4, FIXED_RED_INDEX].map((i) => (
                      <option key={i} value={i}>{colourName(i)}</option>
                    ))}
                  </select>
                  <select aria-label={`${ROLE_LABEL[r]}, shade`} value={sh} onChange={(e) => patch((s) => { s.pointers[r] = [s.pointers[r][0], Number(e.target.value) as Shade]; })}>
                    {SHADES.map((x) => (
                      <option key={x} value={x}>{x === 0 ? "As chosen" : `Shade ${x}`}</option>
                    ))}
                  </select>
                </div>
                <div className="fct-role-out">
                  <span className="fct-sw" style={{ background: R.roles[r] }} />
                  <code>{R.roles[r].toUpperCase()}</code>
                  {r === "ground" || r === "accent3" ? <Pin id={r === "ground" ? "N3" : "N4"} /> : null}
                </div>
                {r === "ground" ? <PinNote id="N3" /> : null}
                {r === "accent3" ? <PinNote id="N4" /> : null}
              </div>
            );
          })}
          <div className="fct-role fct-role-fixed" data-role="onAccent">
            <div className="fct-role-name">
              <strong>{ROLE_LABEL.onAccent}</strong>
              <span>{ROLE_JOB.onAccent}</span>
            </div>
            <div className="fct-role-point">
              <span className="fct-worked">Worked out: whichever of the palette's lightest and darkest contrasts more with the accent.</span>
            </div>
            <div className="fct-role-out">
              <span className="fct-sw" style={{ background: R.roles.onAccent }} />
              <code>{R.roles.onAccent.toUpperCase()}</code>
            </div>
          </div>
        </div>
        <p className="fct-sub fct-small">
          Panel starts as the ground colour one shade down; line as the ink colour at a light shade.{" "}
          {all.site === "elkdonis"
            ? "Danger starts as Fire at shade 800, the reddest of the five."
            : "None of the five reads as red, so danger starts as a fixed red outside the palette (it is the sixth choice in each colour list)."}
        </p>

        {/* 3 Specimen */}
        <Head title="Specimen" pin="N5" />
        <p className="fct-sub">A mock of the home page of {site.label}, drawn only with the roles above. Give each section a tone and it re-points the roles inside that section.</p>
        <div className="fct-frame" style={frameStyle}>
          {site.sections.map((d) => {
            const tone = st.tones[d.key] ?? "plain";
            const set: RoleSet = R.tones[tone];
            return (
              <div key={d.key} className="fct-secwrap" data-section={d.key}>
                <div className="fct-tonebar">
                  <span className="fct-tonename">{d.name}</span>
                  <div className="fct-seg fct-seg-small" role="group" aria-label={`${d.name}, tone`}>
                    {TONES.map((t) => (
                      <button key={t} type="button" aria-pressed={tone === t} onClick={() => patch((s) => { s.tones[d.key] = t; })}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fct-sec" data-tone={tone} style={roleVars(set) as CSSProperties}>
                  {all.site === "elkdonis" ? <ElkSection k={d.key} /> : <AmritSection k={d.key} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* 4 Text styles */}
        <Head title="Text styles" pin="N6" />
        <p className="fct-sub">Two families, six named styles. {site.fonts.note}</p>
        <div className="fct-type" style={frameStyle}>
          {TEXT_STYLES.map((t) => (
            <div key={t.name} className="fct-type-row">
              <span className="fct-type-name">{t.name}</span>
              <span style={{ fontFamily: t.family === "title" ? "var(--f-title)" : "var(--f-body)", fontSize: t.size, fontWeight: t.weight, letterSpacing: t.track, lineHeight: t.line }}>{t.sample}</span>
            </div>
          ))}
        </div>
        <p className="fct-sub">{site.today} The proposal: 6.</p>

        {/* 5 Checks */}
        <Head title="Checks" />
        <p className="fct-sub">Contrast between two colours. Text needs 4.5 or more to read comfortably; large text and marks need 3. These update as you edit.</p>
        <div className="fct-checks">
          {checks.map((c) => {
            const r = ratio(c.a, c.b);
            return (
              <div key={c.label} className="fct-check" data-check={c.label}>
                <span className="fct-pair" style={{ background: c.b, color: c.a }} aria-hidden>Aa</span>
                <span className="fct-check-name">{c.label}</span>
                <span className="fct-ratio">{r.toFixed(2)}</span>
                <span className={`fct-badge ${pass(r, 4.5) ? "ok" : "no"}`}>Text {pass(r, 4.5) ? "passes" : "fails"}</span>
                <span className={`fct-badge ${pass(r, 3) ? "ok" : "no"}`}>Large {pass(r, 3) ? "passes" : "fails"}</span>
                {c.pin ? <Pin id={c.pin} /> : null}
              </div>
            );
          })}
        </div>
        <PinNote id="N8" />

        {/* 6 Before and after */}
        <Head title="Before and after" />
        <div className="fct-strip" role="table" aria-label="Today against the proposal">
          <div className="fct-strip-row fct-strip-top" role="row">
            <span role="columnheader">{site.label}</span>
            <span role="columnheader">Today</span>
            <span role="columnheader">Proposal</span>
          </div>
          {site.before.map((b) => (
            <div key={b.what} className="fct-strip-row" role="row">
              <span role="cell">{b.what}</span>
              <span role="cell" className="fct-today">{b.today}</span>
              <span role="cell" className="fct-prop">{b.proposal}</span>
            </div>
          ))}
        </div>

        <Head title="Off palette today" pin="N7" />
        <p className="fct-sub">Colours typed in by hand that the theme cannot reach, and what each would become. The second chip follows your palette.</p>
        <ul className="fct-off" style={frameStyle}>
          {site.offPalette.map((o) => (
            <li key={o.where}>
              <div className="fct-off-chips">
                {o.literal.map((l) => (
                  <span key={l} className="fct-lit" title={l}>
                    <i style={{ background: l }} />
                    {l}
                  </span>
                ))}
                <span className="fct-arrow" aria-hidden>becomes</span>
                <span className="fct-lit fct-becomes" title={`${o.becomes}: ${R.roles[o.role]}`}>
                  <i style={{ background: R.roles[o.role] }} />
                  {o.becomes}
                </span>
              </div>
              <p>{o.where}</p>
            </li>
          ))}
        </ul>

        {/* 7 All notes */}
        <h2 id="all-notes">All eight notes, in order</h2>
        <ol className="fct-all">
          {NOTES.map((n) => (
            <li key={n.id} id={`all-${n.id}`}>
              <span className="fct-all-id">{n.id}</span>
              <div>
                <strong>{n.where}{n.id === "N2" ? " (Amrit Canada)" : ""}</strong>
                <p>{n.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="fct-sub fct-small">Nothing on this page changes a site. Your choices stay in this browser until you press Back to the proposal.</p>
      </div>
    </PinCtx.Provider>
  );
}

// ---- the specimen's parts: role variables only, no literal colours -----------------------------------------------------

const Btn = ({ children }: { children: ReactNode }) => <button type="button" className="sp-btn">{children}</button>;
const TLink = ({ children }: { children: ReactNode }) => <a href="#specimen" className="sp-link" onClick={(e) => e.preventDefault()}>{children}</a>;
const Label = ({ children }: { children: ReactNode }) => <span className="sp-label"><i aria-hidden />{children}</span>;

function Field({ label, placeholder, error, area }: { label: string; placeholder: string; error?: string; area?: boolean }) {
  const id = useRef("f" + Math.random().toString(36).slice(2, 8)).current;
  return (
    <div className="sp-field">
      <label htmlFor={id} className="sp-fl">{label}</label>
      {area ? <textarea id={id} rows={2} placeholder={placeholder} /> : <input id={id} type="text" placeholder={placeholder} />}
      {error ? <span className="sp-err">{error}</span> : null}
    </div>
  );
}

function ElkSection({ k }: { k: string }) {
  switch (k) {
    case "header":
      return (
        <div className="sp-header">
          <strong className="sp-brand">Elkdonis Arts Collective</strong>
          <nav>
            <TLink>Offerings</TLink>
            <TLink>Mutual Aid</TLink>
            <TLink>Forum</TLink>
            <TLink>About</TLink>
          </nav>
        </div>
      );
    case "hero":
      return (
        <div className="sp-block sp-hero">
          <Label>Opening</Label>
          <h3 className="sp-display">Art as a way of paying attention</h3>
          <p className="sp-body">A community of artists, teachers and neighbours making things together.</p>
          <div className="sp-row">
            <Btn>See current offerings</Btn>
            <TLink>Read about us</TLink>
          </div>
        </div>
      );
    case "offerings":
      return (
        <div className="sp-block">
          <h3 className="sp-title">Current offerings</h3>
          <div className="sp-cards">
            {[["Evening drawing circle", "Thursdays, in person"], ["Sunday sound bath", "Monthly, online"], ["Print workshop", "Two days, small group"]].map(([t, s]) => (
              <article key={t} className="sp-card">
                <Label>Open</Label>
                <h4 className="sp-heading">{t}</h4>
                <p className="sp-small">{s}</p>
              </article>
            ))}
          </div>
        </div>
      );
    case "mutual":
      return (
        <div className="sp-block">
          <h3 className="sp-title">A Mutual Aid Society</h3>
          <span className="sp-bar" aria-hidden />
          <p className="sp-body">Members share what they have: studio time, tools, meals and a little money, offered and asked for in the open.</p>
          <TLink>How it works</TLink>
        </div>
      );
    case "forum":
      return (
        <div className="sp-block">
          <h3 className="sp-title">The Grand Forum</h3>
          <article className="sp-card">
            <Label>Latest</Label>
            <h4 className="sp-heading">Where should the autumn show hang?</h4>
            <p className="sp-small">Twelve replies, the last an hour ago.</p>
          </article>
          <Field area label="Your reply" placeholder="Write a few words" />
          <div className="sp-row"><Btn>Post reply</Btn></div>
        </div>
      );
    case "join":
      return (
        <div className="sp-block">
          <h3 className="sp-title">Join</h3>
          <p className="sp-body">Leave an email address and we will write when the next gathering opens.</p>
          <Field label="Email" placeholder="you@example.org" error="Enter an email address we can reach." />
          <div className="sp-row"><Btn>Join the collective</Btn></div>
        </div>
      );
    default:
      return (
        <div className="sp-footer">
          <div className="sp-row"><TLink>Leave a message</TLink><TLink>Terms</TLink><TLink>Login</TLink></div>
          <p className="sp-small">Elkdonis Arts Collective</p>
        </div>
      );
  }
}

function AmritSection({ k }: { k: string }) {
  switch (k) {
    case "header":
      return (
        <div className="sp-header">
          <strong className="sp-brand">Amrit Canada</strong>
          <nav>
            <TLink>Gatherings</TLink>
            <TLink>Teachers</TLink>
            <TLink>About</TLink>
            <TLink>Resources</TLink>
          </nav>
        </div>
      );
    case "pinned":
      return (
        <div className="sp-block">
          <article className="sp-card">
            <Label>Pinned</Label>
            <h4 className="sp-heading">Amrit Vela gathering</h4>
            <p className="sp-small">Monthly, early morning, online and in person.</p>
            <div className="sp-row"><Btn>RSVP</Btn><TLink>Details</TLink></div>
          </article>
        </div>
      );
    case "upcoming":
      return (
        <div className="sp-block">
          <ul className="sp-rows">
            {[["Evening kirtan", "Fri"], ["Sadhana circle", "Sun"], ["Teachers' talk", "Next month"]].map(([t, w]) => (
              <li key={t}><span className="sp-heading">{t}</span><span className="sp-small">{w}</span></li>
            ))}
          </ul>
          <TLink>2 more</TLink>
        </div>
      );
    case "subheader":
      return (
        <div className="sp-block sp-center">
          <h3 className="sp-title sp-ruled">We are creating upward spirits</h3>
        </div>
      );
    case "teachers":
      return (
        <div className="sp-block">
          <h3 className="sp-title">Teachers</h3>
          <div className="sp-cards">
            {[["Guru Dharam Singh", "Teacher"], ["Guru Fatha Singh", "Teacher"]].map(([n, r]) => (
              <article key={n} className="sp-card">
                <span className="sp-initial" aria-hidden>{n[0]}</span>
                <h4 className="sp-heading">{n}</h4>
                <p className="sp-small">{r}</p>
                <TLink>Read more</TLink>
              </article>
            ))}
          </div>
        </div>
      );
    case "guru":
      return (
        <div className="sp-block">
          <h3 className="sp-title">Guru Dharam</h3>
          <p className="sp-body"><strong>2023</strong> Began leading the monthly Amrit Vela gathering.</p>
          <Field label="Email for reminders" placeholder="you@example.org" />
          <div className="sp-row"><Btn>See upcoming sessions</Btn></div>
        </div>
      );
    default:
      return (
        <div className="sp-footer">
          <div className="sp-row"><TLink>About</TLink><TLink>Resources</TLink><TLink>Login</TLink></div>
          <p className="sp-small">Amrit Canada</p>
        </div>
      );
  }
}
