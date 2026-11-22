"use client";

import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Render, type Config } from "@puckeditor/core";
import type { Block } from "@elkdonis/blocks";
import { contractOf } from "@elkdonis/blocks/contract";
import { partLookAt, tokenOf } from "@elkdonis/direct-edit/puck/morph";
import { renderConfigFor } from "@/components/blocks/configs";
// The shared door (packages/house-editor/src/steps), through this app's one re-export of it.
import { applyStep, fingerprint, sidesOf, type BlockContractLike as ContractLike, type PageDoc as Doc } from "@/lib/sites-door";
import "./manjushri.css";

// ============================================================================
// One document, three hands (Manjushri, 2026-11-20): the idea as something to try.
//
// A real shared block is drawn by Puck's own <Render> from a Puck document, with
// the house config (buildPuckConfig + MorphMark), exactly as a published page draws
// it. Three panels change that one document:
//   Look       picks a part of the block and restyles it (props.morph, cleaned).
//   Words      types into the block's content settings (its declared props).
//   Assistant  sends the same steps as JSON, the way an MCP tool call would.
// All three go through applyStep, the platform's one door (@elkdonis/house-editor/steps). The document is shown split in two, with
// a fingerprint per side, so it is plain that a look step never moves the words and
// a words step never moves the look. Nothing is saved anywhere.
// ============================================================================

type Hand = "look" | "words" | "assistant";
const HAND_LABEL: Record<Hand, string> = { look: "Look", words: "Words", assistant: "Assistant" };
const HAND_BY: Record<Hand, string> = { look: "Look panel", words: "Words panel", assistant: "Assistant" };

/** When a look applies: always, while the pointer is over the part, or on a phone-width screen. */
type When = "base" | "hover" | "sm";
const WHENS: readonly { v: When; label: string; says: string }[] = [
  { v: "base", label: "Always", says: "" },
  { v: "hover", label: "On hover", says: " while the pointer is over it" },
  { v: "sm", label: "On phones", says: " on a phone-width screen" },
];
const whereOf = (w: When): { state?: "hover"; at?: "sm" } => (w === "hover" ? { state: "hover" } : w === "sm" ? { at: "sm" } : {});

interface Entry {
  n: number;
  by: Hand;
  op: unknown;
  ok: boolean;
  say: string;
}

/** Tsakli pigments: the colours offered for a look. */
const PIGMENTS: readonly { name: string; hex: string }[] = [
  { name: "Lapis", hex: "#1f4e79" },
  { name: "Cinnabar", hex: "#c0392b" },
  { name: "Orpiment", hex: "#e0b23c" },
  { name: "Malachite", hex: "#2e7d5b" },
  { name: "Conch white", hex: "#f6f1e4" },
  { name: "Lamp black", hex: "#1b1a17" },
];
const WEIGHTS: readonly { v: number; label: string }[] = [
  { v: 300, label: "Light" },
  { v: 400, label: "Regular" },
  { v: 600, label: "Strong" },
  { v: 800, label: "Heavy" },
];
const CASES: readonly { v: string | null; label: string }[] = [
  { v: null, label: "As written" },
  { v: "upper", label: "Capitals" },
  { v: "smallcaps", label: "Small capitals" },
];
const PREFERRED = ["hero-banner", "feature-card", "quote", "prose", "faq"];
const TEXT_KINDS = new Set(["string", "text"]);

interface Loaded {
  blocks: Block<never>[];
  config: Config;
  contracts: Record<string, ContractLike>;
  start(type: string): Doc;
}

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error !== null ? <p className="mj-fail">This block did not draw: {this.state.error}</p> : this.props.children;
  }
}

/** The elements a declared part names, inside the stage. Selector grammar: PartDef in packages/blocks/src/types.ts. */
function partEls(stage: HTMLElement, parts: ContractLike["parts"], name: string): HTMLElement[] {
  const rootSel = parts?.root?.sel.replace(/^>\s*/, "");
  if (!rootSel) return [];
  try {
    const root = stage.querySelector<HTMLElement>(rootSel);
    if (!root) return [];
    if (name === "root") return [root];
    const sel = parts?.[name]?.sel;
    if (!sel) return [];
    if (sel.startsWith(">")) return [...stage.querySelectorAll<HTMLElement>(sel.replace(/^>\s*/, ""))];
    return [...root.querySelectorAll<HTMLElement>(sel)];
  } catch {
    return [];
  }
}

const depthIn = (el: HTMLElement, stage: HTMLElement) => {
  let d = 0;
  for (let p: HTMLElement | null = el; p && p !== stage; p = p.parentElement) d++;
  return d;
};

export function OneDocument() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState("");
  const [type, setType] = useState("hero-banner");
  const [docs, setDocs] = useState<Record<string, Doc>>({});
  const [hand, setHand] = useState<Hand>("look");
  const [part, setPart] = useState("title");
  const [when, setWhen] = useState<When>("base");
  const [ledger, setLedger] = useState<Entry[]>([]);
  const [lastSide, setLastSide] = useState<"words" | "look" | null>(null);
  const [script, setScript] = useState("");
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await import("@elkdonis/blocks");
        const all = m.SHARED_BLOCKS as unknown as Block<never>[];
        const blocks = all.filter((b) => b.def.parts?.root).sort((a, b) => {
          const ia = PREFERRED.indexOf(a.def.id), ib = PREFERRED.indexOf(b.def.id);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.def.label.localeCompare(b.def.label);
        });
        if (!blocks.length) throw new Error("no shared block declares parts");
        const start = (t: string): Doc => {
          const block = blocks.find((b) => b.def.id === t) ?? blocks[0]!;
          let sample: Record<string, unknown> = {};
          if (block.sample) {
            try {
              const s = (block.sample as () => unknown)();
              if (s && typeof s === "object") sample = s as Record<string, unknown>;
            } catch {
              sample = {};
            }
          }
          const slots: Record<string, unknown> = {};
          for (const name of m.slotNames(block.def)) slots[name] = [];
          return { root: { props: {} }, content: [{ type: block.def.id, props: { ...m.toDefaultProps(block.def), ...sample, ...slots, id: `mj-${block.def.id}` } }] };
        };
        if (!alive) return;
        setLoaded({ blocks, config: renderConfigFor(all), contracts: contractOf(all) as unknown as Record<string, ContractLike>, start });
        if (!blocks.some((b) => b.def.id === "hero-banner")) setType(blocks[0]!.def.id);
      } catch (e) {
        if (alive) setFailed(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const doc = useMemo(() => (loaded ? (docs[type] ?? loaded.start(type)) : null), [loaded, docs, type]);
  const node = doc?.content[0];
  const contract = loaded && node ? loaded.contracts[node.type] : undefined;
  const parts = contract?.parts;
  const blockId = node ? String(node.props.id) : "";

  // A block's first part with words of its own is where a visitor would click first.
  useEffect(() => {
    if (!parts) return;
    if (parts[part]) return;
    setPart(Object.keys(parts).find((p) => parts[p]!.prop && !parts[p]!.prop!.includes(".")) ?? "root");
  }, [parts, part]);

  const run = useCallback(
    (op: unknown, by: Hand) => {
      if (!loaded || !doc) return;
      const out = applyStep(doc, op, { contracts: loaded.contracts });
      if (out.ok && out.side) setDocs((d) => ({ ...d, [type]: out.doc }));
      setLastSide(out.side === "words" || out.side === "look" ? out.side : null);
      const n = ++counter.current;
      setLedger((l) => [{ n, by, op, ok: out.ok, say: out.say }, ...l].slice(0, 40));
    },
    [loaded, doc, type],
  );

  // The outline of the chosen part, measured from the page as drawn.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const target = partEls(el, parts, part)[0];
      if (!target) return setBox(null);
      const a = el.getBoundingClientRect(), b = target.getBoundingClientRect();
      const next = { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height };
      setBox((prev) => (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const t = window.setTimeout(measure, 250);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [doc, parts, part]);

  const pick = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = stage.current;
    if (!el || !parts) return;
    let best: { name: string; depth: number } | null = null;
    for (const name of Object.keys(parts)) {
      for (const candidate of partEls(el, parts, name)) {
        if (!candidate.contains(e.target as Node)) continue;
        const depth = depthIn(candidate, el);
        if (!best || depth > best.depth) best = { name, depth };
      }
    }
    if (best) setPart(best.name);
  };

  if (failed) return <p className="mj-fail">The shared blocks could not be loaded: {failed}</p>;
  if (!loaded || !doc || !node || !contract) return <p className="dev-loading">Loading the shared blocks...</p>;

  const where = whereOf(when);
  const look = partLookAt(node.props, part, where) as Record<string, unknown>;
  const partLabel = parts?.[part]?.label ?? "The block";
  const partProp = parts?.[part]?.prop;
  const { words, look: lookSide } = sidesOf(node);
  const wordProps = contract.props.filter((p) => TEXT_KINDS.has(p.kind) && !p.binds);
  const colourTokens = contract.tokens.filter((t) => t.type === "color").slice(0, 3);

  const setLook = (change: Record<string, unknown>) => run({ op: "set_look", block: blockId, part, look: change, ...where }, "look");
  const step = (key: string, by: number, fallback: number) => {
    const now = typeof look[key] === "number" ? (look[key] as number) : fallback;
    setLook({ [key]: Math.max(0, now + by) });
  };
  const drawnSize = () => {
    const el = stage.current && partEls(stage.current, parts, part)[0];
    return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) || 16 : 16;
  };

  const wordPart = Object.keys(parts ?? {}).find((p) => parts![p]!.prop && wordProps.some((w) => w.name === parts![p]!.prop)) ?? "root";
  const wordProp = parts?.[wordPart]?.prop ?? wordProps[0]?.name ?? "title";
  const presets: { label: string; op: unknown }[] = [
    { label: "Restyle a part", op: { op: "set_look", block: blockId, part: wordPart, look: { color: "#e0b23c", weight: 800, tracking: 0.04 } } },
    { label: "Change it only on hover", op: { op: "set_look", block: blockId, part: wordPart, state: "hover", look: { color: "#c0392b" } } },
    { label: "Rewrite the words", op: { op: "set_prop", block: blockId, prop: wordProp, value: "Written by an assistant, checked by the block" } },
    { label: "Name a part that is not there", op: { op: "set_look", block: blockId, part: "sidebar", look: { fill: "#c0392b" } } },
    { label: "Slip a web address into the look", op: { op: "set_look", block: blockId, part: wordPart, look: { css: "background: url(https://example.com/x.png); position: fixed; letter-spacing: 0.2em" } } },
    { label: "Write the look through the words door", op: { op: "set_prop", block: blockId, prop: "morph", value: { v: 1, parts: {} } } },
  ];

  const runScript = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script);
    } catch {
      const n = ++counter.current;
      setLedger((l) => [{ n, by: "assistant" as Hand, op: script.slice(0, 120), ok: false, say: "That is not valid JSON, so nothing was sent." }, ...l].slice(0, 40));
      setLastSide(null);
      return;
    }
    for (const op of Array.isArray(parsed) ? parsed : [parsed]) run(op, "assistant");
  };

  // "Yet" only until the first step: a refused step also leaves both sides untouched, and says so.
  const sideNote = (side: "words" | "look") => (lastSide === side ? "Changed by the last step" : ledger.length > 0 ? "Untouched by the last step" : "No step has changed it yet");

  return (
    <div className="mj">
      <div className="mj-top">
        <label className="mj-blockpick">
          Block
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setLastSide(null);
            }}
          >
            {loaded.blocks.map((b) => (
              <option key={b.def.id} value={b.def.id}>
                {b.def.label}
              </option>
            ))}
          </select>
        </label>
        <span className="mj-hint">Click any part of the block to choose it. Nothing here is saved.</span>
        <button
          type="button"
          className="mj-quiet"
          onClick={() => {
            setDocs((d) => {
              const next = { ...d };
              delete next[type];
              return next;
            });
            setLastSide(null);
          }}
        >
          Start this block again
        </button>
      </div>

      <div className="mj-work">
        <div className="mj-stagewrap" data-hand={hand}>
          <div ref={stage} className="mj-stage" onClickCapture={pick}>
            <Boundary key={type}>
              <Render config={loaded.config} data={doc as never} />
            </Boundary>
            {box ? (
              <div className="mj-outline" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden>
                <span>{partLabel}</span>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="mj-hands" data-hand={hand}>
          <div className="mj-tabs" role="tablist" aria-label="Who is changing the page">
            {(Object.keys(HAND_LABEL) as Hand[]).map((h) => (
              <button key={h} type="button" role="tab" aria-selected={hand === h} data-hand={h} onClick={() => setHand(h)}>
                {HAND_LABEL[h]}
              </button>
            ))}
          </div>

          {hand === "look" ? (
            <div className="mj-panel">
              <p className="mj-lead">
                Changing how <strong>{partLabel}</strong> looks{WHENS.find((w) => w.v === when)!.says}. The words stay as they are.
              </p>
              <div className="mj-chips" aria-label="Parts of this block">
                {Object.keys(parts ?? {}).map((p) => (
                  <button key={p} type="button" aria-pressed={part === p} onClick={() => setPart(p)}>
                    {parts![p]!.label}
                  </button>
                ))}
              </div>
              <Row label="When">
                <div className="mj-seg">
                  {WHENS.map((w) => (
                    <button key={w.v} type="button" aria-pressed={when === w.v} onClick={() => setWhen(w.v)}>
                      {w.label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Text colour">
                <Swatches value={look.color} onPick={(hex) => setLook({ color: hex })} />
              </Row>
              <Row label="Background">
                <Swatches value={look.fill} onPick={(hex) => setLook({ fill: hex })} />
              </Row>
              <Row label="Text size">
                <Stepper value={look.size} unit="px" none="Its own" onDown={() => step("size", -4, drawnSize())} onUp={() => step("size", 4, drawnSize())} />
              </Row>
              <Row label="Weight">
                <div className="mj-seg">
                  {WEIGHTS.map((w) => (
                    <button key={w.v} type="button" aria-pressed={look.weight === w.v} onClick={() => setLook({ weight: look.weight === w.v ? null : w.v })}>
                      {w.label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Letters">
                <div className="mj-seg">
                  {CASES.map((c) => (
                    <button key={c.label} type="button" aria-pressed={(look.case ?? null) === c.v} onClick={() => setLook({ case: c.v })}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Space inside">
                <Stepper value={look.padding} unit="px" none="Its own" onDown={() => step("padding", -8, 0)} onUp={() => step("padding", 8, 0)} />
              </Row>
              <Row label="Corners">
                <Stepper value={look.radius} unit="px" none="Its own" onDown={() => step("radius", -4, 0)} onUp={() => step("radius", 4, 0)} />
              </Row>
              <button type="button" className="mj-quiet" onClick={() => run({ op: "set_look", block: blockId, part, look: null, ...where }, "look")}>
                Clear {when === "base" ? "the look" : when === "hover" ? "the hover look" : "the phone look"} of {partLabel}
              </button>
              {colourTokens.length ? (
                <>
                  <p className="mj-sub">Colours for the whole block</p>
                  {colourTokens.map((t) => (
                    <Row key={t.name} label={t.label}>
                      <Swatches value={tokenOf(node.props, t.name)} onPick={(hex) => run({ op: "set_token", block: blockId, name: t.name, value: hex }, "look")} />
                    </Row>
                  ))}
                </>
              ) : null}
            </div>
          ) : null}

          {hand === "words" ? (
            <div className="mj-panel">
              <p className="mj-lead">Changing what the block says. Its look stays as it is.</p>
              {partProp && !wordProps.some((w) => w.name === partProp) ? <p className="mj-note">{partLabel} shows a setting that is not plain words, so it is not typed here.</p> : null}
              {!partProp ? <p className="mj-note">{partLabel} has no words of its own. Choose a part with words, or type below.</p> : null}
              {wordProps.length === 0 ? <p className="mj-note">This block has no plain words to type.</p> : null}
              {wordProps.map((p) => {
                const value = typeof node.props[p.name] === "string" ? (node.props[p.name] as string) : "";
                const commit = (el: HTMLInputElement | HTMLTextAreaElement) => {
                  if (el.value !== value) run({ op: "set_prop", block: blockId, prop: p.name, value: el.value }, "words");
                };
                return (
                  <label key={`${type}:${p.name}:${value}`} className="mj-field" data-on={partProp === p.name || undefined}>
                    <span>{p.label}</span>
                    {p.kind === "text" ? (
                      <textarea defaultValue={value} rows={3} onBlur={(e) => commit(e.currentTarget)} />
                    ) : (
                      <input
                        type="text"
                        defaultValue={value}
                        onBlur={(e) => commit(e.currentTarget)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    )}
                  </label>
                );
              })}
              <p className="mj-note">A change is kept when you leave the box or press Enter.</p>
            </div>
          ) : null}

          {hand === "assistant" ? (
            <div className="mj-panel">
              <p className="mj-lead">An assistant has no mouse. It sends the same steps as text, and gets the same answers.</p>
              <div className="mj-presets">
                {presets.map((p) => (
                  <button key={p.label} type="button" onClick={() => setScript(JSON.stringify(p.op, null, 2))}>
                    {p.label}
                  </button>
                ))}
              </div>
              <textarea className="mj-script" spellCheck={false} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Choose a step above, or write one" rows={9} aria-label="The step to send" />
              <button type="button" className="mj-go" onClick={runScript} disabled={!script.trim()}>
                Send this step
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="mj-doc">
        <section className="mj-side" data-side="words" data-hot={lastSide === "words" || undefined}>
          <header>
            <h3>What it says</h3>
            <span className="mj-print" title="A fingerprint of this side of the document">
              {fingerprint(words)}
            </span>
            <span className="mj-state">{sideNote("words")}</span>
          </header>
          <pre>{JSON.stringify(words, null, 2)}</pre>
        </section>
        <section className="mj-side" data-side="look" data-hot={lastSide === "look" || undefined}>
          <header>
            <h3>How it looks</h3>
            <span className="mj-print" title="A fingerprint of this side of the document">
              {fingerprint(lookSide)}
            </span>
            <span className="mj-state">{sideNote("look")}</span>
          </header>
          <pre>{lookSide ? JSON.stringify(lookSide, null, 2) : "No look yet. The block draws the way its maker designed it."}</pre>
        </section>
      </div>
      <p className="mj-caption">
        Both sides are one stored object for this block, the same one Puck saves. The look sits under a single key that Puck's own settings panel never shows, so the two cannot overwrite each other.
      </p>

      <section className="mj-ledger" aria-label="Every step so far">
        <h3>Every change, as a step</h3>
        {ledger.length === 0 ? (
          <p className="mj-note">Change something above. Each change is written here as the step that was sent, whoever sent it.</p>
        ) : (
          <ol>
            {ledger.map((e) => (
              <li key={e.n} data-hand={e.by} data-ok={e.ok}>
                <span className="mj-who">{HAND_BY[e.by]}</span>
                <code>{typeof e.op === "string" ? e.op : JSON.stringify(e.op)}</code>
                <span className="mj-say">{e.ok ? e.say : `Refused. ${e.say}`}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mj-row">
      <span className="mj-rowlabel">{label}</span>
      {children}
    </div>
  );
}

function Swatches({ value, onPick }: { value: unknown; onPick(hex: string | null): void }) {
  return (
    <div className="mj-swatches">
      <button type="button" className="mj-none" aria-pressed={!value} title="Its own" onClick={() => onPick(null)} />
      {PIGMENTS.map((p) => (
        <button key={p.hex} type="button" aria-pressed={value === p.hex} title={p.name} aria-label={p.name} style={{ background: p.hex }} onClick={() => onPick(p.hex)} />
      ))}
    </div>
  );
}

function Stepper({ value, unit, none, onDown, onUp }: { value: unknown; unit: string; none: string; onDown(): void; onUp(): void }) {
  return (
    <div className="mj-stepper">
      <button type="button" onClick={onDown} aria-label="Less">
        −
      </button>
      <output>{typeof value === "number" ? `${value}${unit}` : none}</output>
      <button type="button" onClick={onUp} aria-label="More">
        +
      </button>
    </div>
  );
}
