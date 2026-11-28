"use client";

import * as React from "react";
import "@elkdonis/cms-ui/offer-surface.css";
import { OFFER_FONTS_HREF } from "@elkdonis/cms-ui/offer-surface";
import {
  CHECKED_AT,
  contract,
  cssRules,
  flowContext,
  flows,
  fontTemplates,
  layers,
  layerSandboxPath,
  lookAlikes,
  mountExample,
  offContract,
  patternGroups,
  shell,
  stackRule,
  problems,
  surfaceParts,
  templateEntries,
  tokens,
  addressing,
  type LayerEntry,
  type TemplateEntry,
} from "./catalogue";
import "./gallery.css";
import "./catalogue.css";

// ============================================================================
// The Catalogue view: the offer templates, patterns, popups, flows, tokens and data
// contract as documentation and code examples. All content comes from ./catalogue.ts
// (the same module the JSON door serves), so the page and the JSON cannot disagree.
// Anchors: #cat-templates, #cat-template-<id>, #cat-patterns, #cat-popups, #cat-layer-<id>,
// #cat-flows, #cat-tokens, #cat-contract.
// ============================================================================

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SECTIONS = [
  ["cat-templates", "Templates"],
  ["cat-patterns", "Patterns"],
  ["cat-popups", "Popups"],
  ["cat-flows", "Flows"],
  ["cat-tokens", "Tokens and type"],
  ["cat-contract", "Data contract"],
] as const;

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** An iframe drawn at its true size and scaled to its column (same approach as the Live view). */
function Scaled({ src, width, height, title }: { src: string; width: number; height: number; title: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.4);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={box} className="gl-scaled" style={{ height: Math.round(height * scale) + 2 }}>
      <iframe title={title} src={src} width={width} height={height} loading="lazy" style={{ width, height, transform: `scale(${scale})` }} />
    </div>
  );
}

function Code({ children }: { children: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text stays selectable */
    }
  };
  return (
    <div className="cat-code">
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Path({ children }: { children: React.ReactNode }) {
  return <code className="cat-path">{children}</code>;
}

// ── Templates ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  return <span className={`cat-chip cat-st-${status}`}>{status}</span>;
}

function layerLink(id: string) {
  const known = layers.some((l) => l.id === id);
  return known ? (
    <a key={id} href={`#cat-layer-${id}`} className="cat-lid">
      {id}
    </a>
  ) : (
    <span key={id}>{id}</span>
  );
}

/** "evt-offer" or "pay (flow evt)..." : link the leading layer id when the text starts with one. */
function OpensText({ text }: { text: string }) {
  const m = /^([a-z]+(?:-[a-z]+)*)\b(.*)$/.exec(text);
  if (m && layers.some((l) => l.id === m[1])) {
    return (
      <>
        {layerLink(m[1]!)}
        {m[2]}
      </>
    );
  }
  return <>{text}</>;
}

function TemplateCard({ e }: { e: TemplateEntry }) {
  const { info, meta } = e;
  const src = `${BASE}${e.sandbox}?ft=para`;
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDetailsElement>(null);
  // A link to #cat-template-<id> opens this card and scrolls to it.
  React.useEffect(() => {
    const go = () => {
      if (window.location.hash !== `#cat-template-${info.id}`) return;
      setOpen(true);
      setTimeout(() => ref.current?.scrollIntoView({ block: "start" }), 50);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [info.id]);
  return (
    <details ref={ref} className="cat-card" id={`cat-template-${info.id}`} open={open} onToggle={(ev) => setOpen(ev.currentTarget.open)}>
      <summary>
        <span className="cat-card-name">{info.name}</span>
        <span className="cat-chip">{info.packet === "derived" ? "no mock: derived" : `mock ${info.packet}`}</span>
        <StatusChip status={meta.status} />
        <span className="cat-card-counts">
          {plural(e.counts.reads, "data path")} · {plural(e.counts.actions, "control")} · {plural(e.counts.patterns, "pattern")}
        </span>
      </summary>
      <div className="cat-card-body">
        <p className="cat-lede">
          {info.blurb} Suits: {info.kinds.join(", ")}. Component <code>{meta.component}</code>. Phone height at 390 wide: {meta.phoneHeight ? `${meta.phoneHeight}px` : "not recorded in its meta"}.
        </p>

        <h4>Live example</h4>
        <div className="cat-frames">
          <div className="cat-frame-desk">
            <Scaled src={src} width={1280} height={800} title={`${info.name}, desktop`} />
            <span className="cat-cap">Desktop, 1280 x 800 (the sample site, para font template)</span>
          </div>
          <div className="cat-frame-phone">
            <Scaled src={src} width={390} height={844} title={`${info.name}, phone`} />
            <span className="cat-cap">Phone, 390 x 844</span>
          </div>
        </div>
        <p className="cat-cap">
          <a href={src} target="_blank" rel="noreferrer">
            Open full window
          </a>{" "}
          · <a href={`${BASE}/offer-templates#t=${info.id}`}>Open in the Live view (all look switches)</a>
        </p>

        <h4>Data it reads</h4>
        <div className="cat-scroll">
          <table className="dev-table cat-table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Required</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {meta.reads.map((r) => (
                <tr key={r.path}>
                  <td>
                    <code>{r.path}</code>
                  </td>
                  <td>{r.required ? "required" : "optional"}</td>
                  <td className="cat-wrap">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta.missing && meta.missing.length > 0 && (
          <>
            <h4>Fields it needed that the contract lacks</h4>
            <ul className="cat-list">
              {meta.missing.map((m) => (
                <li key={m.path}>
                  <code>{m.path}</code>: {m.why}
                </li>
              ))}
            </ul>
          </>
        )}

        <h4>What each control opens</h4>
        <div className="cat-scroll">
          <table className="dev-table cat-table">
            <thead>
              <tr>
                <th>Control</th>
                <th>Opens</th>
              </tr>
            </thead>
            <tbody>
              {meta.actions.map((a) => (
                <tr key={a.control}>
                  <td className="cat-wrap">{a.control}</td>
                  <td className="cat-wrap">
                    <OpensText text={a.opens} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Patterns inside</h4>
        <div className="cat-scroll">
          <table className="dev-table cat-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Use</th>
                <th>Root class</th>
                <th>Shared</th>
              </tr>
            </thead>
            <tbody>
              {meta.patterns.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={`#cat-pattern-${p.id}`}>{p.name}</a>
                  </td>
                  <td className="cat-wrap">{p.use}</td>
                  <td>
                    <code>.{p.rootClass}</code>
                  </td>
                  <td>{p.shared ? "yes: another template draws the same" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Where it departs from the mock</h4>
        <ul className="cat-list">
          {meta.adapted.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>

        <h4>Files</h4>
        <dl className="cat-files">
          <dt>Component</dt>
          <dd>
            <Path>{meta.files.tsx}</Path>
          </dd>
          <dt>Styles</dt>
          <dd>
            <Path>{meta.files.css}</Path>
          </dd>
          <dt>Meta (this entry)</dt>
          <dd>
            <Path>{meta.files.tsx.replace(/\.tsx$/, ".meta.tsx")}</Path>
          </dd>
          <dt>Sandbox route</dt>
          <dd>
            <Path>{meta.files.route}</Path>
          </dd>
          <dt>Page width</dt>
          <dd>{e.scaleBase ? `--ost-base ${e.scaleBase} (scales up from ${e.scaleBase}px on a wider window)` : "not recorded"}</dd>
        </dl>

        <h4>Mount it</h4>
        <Code>{mountExample(e)}</Code>
      </div>
    </details>
  );
}

function ShellBlock() {
  return (
    <div className="cat-shell" id="cat-shell">
      <h3>
        The shell every template draws in: <code>{shell.component}</code>
      </h3>
      <p className="cat-cap">
        Not a template: the top bar (site name, Profile, + Follow), the main area and the gateway strip (&quot;Also offered&quot;). Mock {shell.packet}. Files: <Path>{shell.files.tsx}</Path>, <Path>{shell.files.css}</Path>; sandbox route <Path>{shell.files.route}</Path>.
      </p>
      <div className="cat-scroll">
        <table className="dev-table cat-table">
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {shell.props.map((p) => (
              <tr key={p.name}>
                <td>
                  <code>{p.name}</code>
                </td>
                <td>
                  <code>{p.type}</code>
                </td>
                <td className="cat-wrap">{p.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cat-cap">Reads: {shell.reads.join(", ")}.</p>
      <ul className="cat-list">
        {shell.actions.map((a) => (
          <li key={a.control}>
            {a.control}: {a.opens}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemplatesSection() {
  return (
    <section id="cat-templates" className="cat-sec">
      <h2>Templates ({templateEntries.length})</h2>
      <p className="cat-lede">
        One template per way of laying out the single featured piece. Each takes the same <code>TemplateData</code> and draws inside <code>TemplateShell</code>. Open one for its live example, the data it reads, what its controls open, its patterns and a mounting example. Entries are read from each template&apos;s own <code>&lt;id&gt;.meta.tsx</code>.
      </p>
      <div className="cat-scroll">
        <table className="dev-table cat-table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Mock</th>
              <th>Status</th>
              <th>Suits</th>
              <th>Data paths</th>
              <th>Required</th>
              <th>Controls</th>
              <th>Inert</th>
              <th>Patterns</th>
              <th>Shared</th>
            </tr>
          </thead>
          <tbody>
            {templateEntries.map((e) => (
              <tr key={e.info.id}>
                <td>
                  <a href={`#cat-template-${e.info.id}`}>{e.info.name}</a> <code>{e.info.id}</code>
                </td>
                <td>{e.info.packet}</td>
                <td>
                  <StatusChip status={e.meta.status} />
                </td>
                <td>{e.info.kinds.join(", ")}</td>
                <td>{e.counts.reads}</td>
                <td>{e.counts.requiredReads}</td>
                <td>{e.counts.actions}</td>
                <td>{e.counts.inertActions}</td>
                <td>{e.counts.patterns}</td>
                <td>{e.counts.sharedPatterns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cat-cap">
        Status words are the meta files&apos; own: draft (built, not yet checked against its mock), matches-packet (checked), derived (the mock has no page for it, so it was drawn in the mock&apos;s language). &quot;Inert&quot; counts controls whose meta says inert or not built.
      </p>
      <div className="cat-cards">
        {templateEntries.map((e) => (
          <TemplateCard key={e.info.id} e={e} />
        ))}
      </div>
      <ShellBlock />
    </section>
  );
}

// ── Patterns ────────────────────────────────────────────────────────────────

function PatternsSection() {
  const repeated = patternGroups.filter((g) => g.repeated);
  const single = patternGroups.filter((g) => !g.repeated);
  const total = patternGroups.reduce((n, g) => n + g.uses.length, 0);
  return (
    <section id="cat-patterns" className="cat-sec">
      <h2>Patterns ({total} entries, {patternGroups.length} distinct ids)</h2>
      <p className="cat-lede">
        Every pattern the templates and the shell list, grouped by id. {repeated.length} ids appear in more than one place: those are the first candidates for shared parts. The ones marked shared in a meta but with an id of their own are in the second list. Counts are from the meta files; nothing here has been lifted into shared code yet.
      </p>

      <h3>Repeated ids ({repeated.length})</h3>
      <div className="cat-scroll">
        <table className="dev-table cat-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Drawn by</th>
              <th>Root class in each</th>
            </tr>
          </thead>
          <tbody>
            {repeated.map((g) => (
              <tr key={g.id} id={`cat-pattern-${g.id}`}>
                <td>
                  <code>{g.id}</code> <span className="cat-chip">{plural(g.count, "place")}</span>
                </td>
                <td className="cat-wrap">
                  {g.uses.map((u, i) => (
                    <span key={u.source}>
                      {i > 0 && ", "}
                      {u.source}
                      {u.shared ? " (shared)" : ""}
                    </span>
                  ))}
                </td>
                <td className="cat-wrap">
                  {g.uses.map((u) => (
                    <code key={u.source} className="cat-block">
                      .{u.rootClass}
                    </code>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Looks alike under different ids ({lookAlikes.length})</h3>
      <p className="cat-cap">This list is the catalogue author&apos;s reading of the names and descriptions. It is not in the meta files; confirm against the CSS before lifting.</p>
      <ul className="cat-list">
        {lookAlikes.map((l) => (
          <li key={l.name}>
            <strong>{l.name}</strong> (
            {l.ids.map((id, i) => (
              <React.Fragment key={id}>
                {i > 0 && ", "}
                <code>{id}</code>
              </React.Fragment>
            ))}
            ): {l.why}
          </li>
        ))}
      </ul>

      <h3>All other patterns ({single.length})</h3>
      <div className="cat-scroll">
        <table className="dev-table cat-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>In</th>
              <th>Use</th>
              <th>Root class</th>
              <th>Marked shared</th>
            </tr>
          </thead>
          <tbody>
            {single.map((g) => {
              const u = g.uses[0]!;
              return (
                <tr key={g.id} id={`cat-pattern-${g.id}`}>
                  <td>
                    <code>{g.id}</code>
                  </td>
                  <td>{u.source}</td>
                  <td className="cat-wrap">{u.use}</td>
                  <td>
                    <code>.{u.rootClass}</code>
                  </td>
                  <td>{u.shared ? "yes" : "no"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Popups ──────────────────────────────────────────────────────────────────

function flowPositions(id: string): string[] {
  const out: string[] = [];
  for (const f of flows) {
    const i = f.steps.indexOf(id as never);
    if (i >= 0) out.push(`${f.name}: step ${i + 1} of ${f.steps.length}`);
    for (const a of f.alternatives) {
      const j = a.steps.indexOf(id as never);
      if (j >= 0 && i < 0) out.push(`${f.name} (${a.label}): step ${j + 1} of ${a.steps.length}`);
    }
  }
  return out;
}

function LayerCard({ l }: { l: LayerEntry }) {
  const href = `${BASE}${layerSandboxPath(l)}`;
  return (
    <article className="cat-layer" id={`cat-layer-${l.id}`}>
      <header>
        <h3>
          <code>{l.id}</code> {l.name}
        </h3>
        <span className={`cat-chip cat-ls-${l.status === "built" ? "ok" : "part"}`}>{l.status}</span>
      </header>
      <p>{l.forWhat}</p>
      <dl className="cat-kv">
        <dt>Flow position</dt>
        <dd>{flowPositions(l.id).join(" · ") || "not in a flow"}</dd>
        <dt>Opened by</dt>
        <dd>
          <ul>
            {l.openedBy.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </dd>
        <dt>Pushes</dt>
        <dd>
          {l.pushes.length ? (
            <ul>
              {l.pushes.map((o) => (
                <li key={o}>
                  <OpensText text={o} />
                </li>
              ))}
            </ul>
          ) : (
            "nothing"
          )}
        </dd>
        {l.replaces.length > 0 && (
          <>
            <dt>Replaces / pops</dt>
            <dd>{l.replaces.join("; ")}</dd>
          </>
        )}
        <dt>Head button</dt>
        <dd>{l.headButton ?? "none"}</dd>
        <dt>Primary action</dt>
        <dd>{l.primary ?? "none"}</dd>
        {l.quiet && (
          <>
            <dt>Quiet action</dt>
            <dd>{l.quiet}</dd>
          </>
        )}
        <dt>Real or sample-only</dt>
        <dd>{l.statusNote}</dd>
        <dt>Code</dt>
        <dd>
          <Path>{l.file}</Path> <code>{l.component}</code>
        </dd>
      </dl>
      <a className="cat-open" href={href} target="_blank" rel="noreferrer">
        Open it in the sandbox
      </a>
    </article>
  );
}

function PopupsSection() {
  return (
    <section id="cat-popups" className="cat-sec">
      <h2>Popups ({layers.length} layers)</h2>
      <p className="cat-lede">
        The surfaces: a popup on desktop, a bottom sheet on a phone. They stack on the page and nothing on the page redirects. Every layer below is built; &quot;sample-only&quot; marks the ones whose backend call is faked in the sandbox or not wired at all. &quot;Open it in the sandbox&quot; loads the profile page with that layer already open, using the sample site (<code>{addressing.param}</code>).
      </p>
      <div className="cat-layers">
        {layers.map((l) => (
          <LayerCard key={l.id} l={l} />
        ))}
      </div>

      <h3>Surface parts that are not layers ({surfaceParts.length})</h3>
      <div className="cat-scroll">
        <table className="dev-table cat-table">
          <thead>
            <tr>
              <th>Part</th>
              <th>What it is</th>
              <th>Where</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {surfaceParts.map((p) => (
              <tr key={p.name}>
                <td>
                  {p.name} <code>{p.component}</code>
                </td>
                <td className="cat-wrap">{p.what}</td>
                <td>
                  <Path>{p.file}</Path>
                </td>
                <td className="cat-wrap">{p.opens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Flows ───────────────────────────────────────────────────────────────────

function Chain({ steps }: { steps: string[] }) {
  return (
    <span className="cat-chain">
      {steps.map((s, i) => (
        <React.Fragment key={`${s}-${i}`}>
          {i > 0 && <span className="cat-arrow">{s === "replace-wr-read" ? " ↔ " : " → "}</span>}
          {s === "replace-wr-read" ? <code>wr-read</code> : layerLink(s)}
        </React.Fragment>
      ))}
    </span>
  );
}

function FlowsSection() {
  return (
    <section id="cat-flows" className="cat-sec">
      <h2>Flows ({flows.length})</h2>
      <p className="cat-lede">
        The paths through the layers, from the design packet&apos;s README (section A, Flows) mapped to layer ids. A crumb in a layer&apos;s head pops one layer, Esc pops one, the close button closes the whole stack. Transaction layers read <code>ctx.flow</code> to know what they are finishing.
      </p>
      {flows.map((f) => (
        <div key={f.id} className="cat-flow" id={`cat-flow-${f.id}`}>
          <h3>{f.name}</h3>
          <p>
            <Chain steps={f.steps} />
          </p>
          {f.alternatives.map((a) => (
            <p key={a.label} className="cat-alt">
              {a.label}: <Chain steps={a.steps} />
            </p>
          ))}
          <p className="cat-cap">
            {f.flowCtx ? (
              <>
                ctx.flow = <code>{f.flowCtx}</code> ·{" "}
              </>
            ) : (
              "no ctx.flow · "
            )}
            Source: {f.source}.{f.note ? ` ${f.note}` : ""}
          </p>
        </div>
      ))}
      <h3>Back, close and finish (the stack rule)</h3>
      <div className="cat-scroll">
        <table className="dev-table cat-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {stackRule.map((r) => (
              <tr key={r.action}>
                <td className="cat-wrap">{r.action}</td>
                <td className="cat-wrap">{r.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>What ctx.flow means</h3>
      <ul className="cat-list">
        {flowContext.map((c) => (
          <li key={c.id}>
            <code>{c.id}</code>: {c.meaning}
          </li>
        ))}
      </ul>
      <h3>How a layer is addressed</h3>
      <p>
        <code>{addressing.param}</code>, for example <code>{addressing.example}</code>
      </p>
      <ul className="cat-list">
        {addressing.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  );
}

// ── Tokens and type ─────────────────────────────────────────────────────────

function TokenRow({ t, live }: { t: (typeof tokens)[number]; live: Record<string, string> }) {
  const isColour = /^#|^rgb/.test(t.value);
  const got = live[t.name];
  const same = got === undefined ? null : got.replace(/\s+/g, " ") === t.value.replace(/\s+/g, " ");
  return (
    <tr>
      <td>
        {t.group === "Other" && !isColour ? (
          <span className="cat-sw cat-sw-none" />
        ) : (
          <span className="cat-sw" style={{ background: `var(${t.name})` }} />
        )}
      </td>
      <td>
        <code>{t.name}</code>
      </td>
      <td>
        <code>{t.value}</code>
      </td>
      <td className="cat-wrap">
        {t.use}
        {t.contrast ? ` · contrast ${t.contrast}` : ""}
      </td>
      <td>{same === null ? "" : same ? "matches the live CSS" : `live CSS says ${got}`}</td>
    </tr>
  );
}

function TokensSection() {
  const scope = React.useRef<HTMLDivElement>(null);
  const [live, setLive] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const next: Record<string, string> = {};
    for (const t of tokens) next[t.name] = cs.getPropertyValue(t.name).trim();
    setLive(next);
  }, []);
  const groups = [...new Set(tokens.map((t) => t.group))];
  return (
    <section id="cat-tokens" className="cat-sec">
      <h2>Tokens and type ({tokens.length} tokens, {fontTemplates.length} font templates)</h2>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={OFFER_FONTS_HREF} precedence="default" />
      <p className="cat-lede">
        Swatches are drawn from the real CSS variables in <Path>packages/cms-ui/src/offer-surface/look.css</Path>; the last column compares each written value here with what the page&apos;s CSS says now. Colours come only from these tokens.
      </p>
      <div ref={scope} className="eac-offer cat-scope" data-ft="para" data-tint="on">
        {groups.map((g) => (
          <React.Fragment key={g}>
            <h3>{g}</h3>
            <div className="cat-scroll">
              <table className="dev-table cat-table">
                <thead>
                  <tr>
                    <th>Swatch</th>
                    <th>Variable</th>
                    <th>Value</th>
                    <th>Use</th>
                    <th>Check</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens
                    .filter((t) => t.group === g)
                    .map((t) => (
                      <TokenRow key={t.name} t={t} live={live} />
                    ))}
                </tbody>
              </table>
            </div>
          </React.Fragment>
        ))}
      </div>

      <h3>The six font templates</h3>
      <p className="cat-cap">
        Chosen per site (<code>look.font</code>, becomes <code>data-ft</code>). Each sets five faces and a heading scale; templates draw type only through the <code>--fh</code>, <code>--fb</code>, <code>--fq</code>, <code>--fu</code>, <code>--fk</code> variables, so all six work. Marquee (1.3) is the wide one; Rite is italic.
      </p>
      <div className="cat-fonts" id="cat-fonts">
        {fontTemplates.map((f) => (
          <div key={f.id} className="eac-offer cat-font" data-ft={f.id} data-tint="on">
            <div className="cat-font-head">
              <span className="cat-font-kicker">{f.name}</span>
              <code>data-ft=&quot;{f.id}&quot;</code>
            </div>
            <div className="cat-font-title">Title of the piece</div>
            <p className="cat-font-body">A standfirst: one or two sentences that say what this piece is about, set in the body face of this template.</p>
            <p className="cat-font-quote">A pull quote in the quote face.</p>
            <span className="cat-font-btn">Button label</span>
            <dl className="cat-kv cat-font-kv">
              <dt>Heading</dt>
              <dd>
                {f.heading}, weight {f.weight}
                {f.headingCase !== "none" ? `, ${f.headingCase}` : ""}
                {f.headingStyle !== "normal" ? `, ${f.headingStyle}` : ""}, scale {f.scale}
              </dd>
              <dt>Body</dt>
              <dd>{f.body}</dd>
              <dt>Quote</dt>
              <dd>{f.quote}</dd>
              <dt>Buttons and labels</dt>
              <dd>{f.ui}</dd>
              <dt>Kicker</dt>
              <dd>{f.kicker}</dd>
              {f.note && (
                <>
                  <dt>Note</dt>
                  <dd>{f.note}</dd>
                </>
              )}
            </dl>
          </div>
        ))}
      </div>

      <h3>Shared CSS rules ({cssRules.length})</h3>
      <div className="cat-scroll">
        <table className="dev-table cat-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>What</th>
              <th>Where it is written</th>
            </tr>
          </thead>
          <tbody>
            {cssRules.map((r) => (
              <tr key={r.id}>
                <td>
                  <code>{r.id}</code>
                </td>
                <td className="cat-wrap">{r.rule}</td>
                <td className="cat-wrap">{r.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Data contract ───────────────────────────────────────────────────────────

function ContractSection() {
  const fields = contract.reduce((n, t) => n + t.fields.length, 0);
  return (
    <section id="cat-contract" className="cat-sec">
      <h2>Data contract ({contract.length} types, {fields} fields)</h2>
      <p className="cat-lede">
        What a page and its surfaces take. Each field has a one-line meaning and the file and line where the type declares it; the types themselves are not copied here, so the file is the authority. Lines were last compared with the files on {CHECKED_AT}.
      </p>
      {contract.map((t) => (
        <div key={t.name} className="cat-type" id={`cat-type-${t.name}`}>
          <h3>
            <code>{t.name}</code>
          </h3>
          <p className="cat-cap">
            <Path>
              {t.file}:{t.line}
            </Path>{" "}
            {t.what}
          </p>
          <div className="cat-scroll">
            <table className="dev-table cat-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Meaning</th>
                  <th>Line</th>
                </tr>
              </thead>
              <tbody>
                {t.fields.map((f) => (
                  <tr key={f.name}>
                    <td>
                      <code>{f.name}</code>
                    </td>
                    <td className="cat-wrap">
                      <code>{f.type}</code>
                    </td>
                    <td>{f.required ? "required" : "optional"}</td>
                    <td className="cat-wrap">{f.meaning}</td>
                    <td>{f.line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <h3>Read by the code but not in any type above</h3>
      <ul className="cat-list">
        {offContract.map((o) => (
          <li key={o.path}>
            <code>{o.path}</code> ({o.where}): {o.meaning}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── The view ────────────────────────────────────────────────────────────────

export function Catalogue({ withTitle = false }: { withTitle?: boolean }) {
  const repeated = patternGroups.filter((g) => g.repeated).length;
  const total = patternGroups.reduce((n, g) => n + g.uses.length, 0);

  // Open and scroll to an anchor, including a template card that starts closed.
  React.useEffect(() => {
    const go = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (!id.startsWith("cat-")) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: "start" });
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  return (
    <div className="cat">
      {withTitle && (
        <>
          <h1>Offer catalogue</h1>
          <p className="dev-lede">The single-offer site&apos;s templates, popups, flows, tokens and data contract, as documentation and code examples.</p>
        </>
      )}
      <div className="cat-top">
        <p className="cat-summary">
          {plural(templateEntries.length, "template")} · {plural(total, "pattern entry", "pattern entries")} ({patternGroups.length} distinct ids, {repeated} repeated) · {plural(layers.length, "popup layer")} · {plural(flows.length, "flow")} · {plural(tokens.length, "token")} · {plural(fontTemplates.length, "font template")} · {plural(contract.length, "contract type")}
        </p>
        <p className="cat-cap">
          Checked against the code on {CHECKED_AT}. {problems.length === 0 ? "Every template's meta file agrees with the template list (id, mock, file paths)." : `${plural(problems.length, "disagreement")} between a meta file and the template list: ${problems.join(" ")}`}
        </p>
        <p className="cat-cap">
          For agents: the same content as one JSON document at <a href={`${BASE}/offer-templates/catalogue.json`}>{`${BASE}/offer-templates/catalogue.json`}</a> (network admin session), and the written guide at <Path>packages/cms-ui/src/offer-surface/README.md</Path>.
        </p>
      </div>
      <nav className="cat-nav" aria-label="Catalogue sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <TemplatesSection />
      <PatternsSection />
      <PopupsSection />
      <FlowsSection />
      <TokensSection />
      <ContractSection />
    </div>
  );
}
