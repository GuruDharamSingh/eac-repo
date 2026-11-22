"use client";

import { useEffect, useMemo, useState } from "react";
import { applySteps, hasStatesAndSizes, type BlockContractLike, type PageDoc, type Step } from "@/lib/sites-door";
import { listBlocks } from "@/lib/sites-doc";

// ============================================================================
// The four hands on a real page (generalised from the sandbox idea "One document, three hands"):
//   Words      type into one of a block's own text settings
//   Look       pick one of its parts and restyle it (always, or when hovered, focused or pressed; on every screen or phones)
//   Blocks     add, move, copy or remove a block, at the top of the page or inside another block
//   Assistant  paste steps as JSON, the way an assistant's tool call would send them
// All four build the same kind of step and send it through the one door (`applySteps`), which checks it
// against the block's own declaration and says in plain words why it refuses. Accepted steps are only
// held here; "Save as a draft" (SitePageView) sends them to the server, which checks them again.
// ============================================================================

interface Entry {
  n: number;
  by: "Words" | "Look" | "Blocks" | "Assistant";
  ok: boolean;
  say: string;
}

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
const WHENS: readonly { v: "" | "hover" | "focus" | "active"; label: string }[] = [
  { v: "", label: "Always" },
  { v: "hover", label: "When the pointer is over it" },
  { v: "focus", label: "When it has the keyboard" },
  { v: "active", label: "While it is pressed" },
];
const SCREENS: readonly { v: "" | "sm" | "md"; label: string }[] = [
  { v: "", label: "Every screen size" },
  { v: "sm", label: "Phones" },
  { v: "md", label: "Tablets and below" },
];
const TEXT_KINDS = new Set(["string", "text"]);
const ROOT_ZONE = "root:default-zone";

interface Props {
  /** The page as it stands with the unsaved steps applied. */
  doc: PageDoc;
  contracts: Record<string, BlockContractLike>;
  /** The small config the structure steps run on (plain data: each block's slots). */
  config: unknown;
  pending: Step[];
  onPending: (steps: Step[]) => void;
}

/** Every place a block can go: the top of the page, then each slot of each block that has one, with how many blocks it holds now. */
function placesOf(doc: PageDoc, contracts: Record<string, BlockContractLike>, config: unknown) {
  const comps = (config as { components?: Record<string, { fields?: Record<string, { type?: string }> }> } | null)?.components ?? {};
  const out: { zone: string; label: string; size: number }[] = [{ zone: ROOT_ZONE, label: "The top level of the page", size: doc.content.length }];
  for (const b of listBlocks(doc)) {
    if (typeof b.node.props.id !== "string") continue;
    const fields = Object.prototype.hasOwnProperty.call(comps, b.type) ? (comps[b.type]!.fields ?? {}) : {};
    for (const [slot, f] of Object.entries(fields)) {
      if (f?.type !== "slot") continue;
      const list = b.node.props[slot];
      const label = contracts[b.type]?.props.find((p) => p.name === slot)?.label ?? slot;
      out.push({ zone: `${b.id}:${slot}`, label: `Inside ${contracts[b.type]?.label ?? b.type} (${b.id}), ${label}`, size: Array.isArray(list) ? list.length : 0 });
    }
  }
  return out;
}

export function SiteHands({ doc, contracts, config, pending, onPending }: Props) {
  const choices = useMemo(() => listBlocks(doc).filter((b) => contracts[b.type] && typeof b.node.props.id === "string"), [doc, contracts]);
  const allTypes = useMemo(
    () =>
      Object.entries(contracts)
        .map(([id, c]) => ({ id, label: c.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [contracts],
  );
  const places = useMemo(() => placesOf(doc, contracts, config), [doc, contracts, config]);
  const [blockId, setBlockId] = useState("");
  const [hand, setHand] = useState<"words" | "look" | "blocks" | "assistant">("words");
  const [ledger, setLedger] = useState<Entry[]>([]);
  const [setting, setSetting] = useState("");
  const [text, setText] = useState("");
  const [part, setPart] = useState("root");
  const [when, setWhen] = useState<"" | "hover" | "focus" | "active">("");
  const [screen, setScreen] = useState<"" | "sm" | "md">("");
  const [script, setScript] = useState("");
  const [addType, setAddType] = useState("");
  const [zone, setZone] = useState(ROOT_ZONE);
  const [index, setIndex] = useState("");
  const placed = hasStatesAndSizes();

  useEffect(() => {
    if (!choices.some((c) => c.id === blockId)) setBlockId(choices[0]?.id ?? "");
  }, [choices, blockId]);
  useEffect(() => {
    if (!places.some((p) => p.zone === zone)) setZone(ROOT_ZONE);
  }, [places, zone]);
  useEffect(() => {
    if (!addType && allTypes[0]) setAddType(allTypes.find((t) => t.id === "words")?.id ?? allTypes[0].id);
  }, [allTypes, addType]);

  const chosen = choices.find((c) => c.id === blockId);
  const contract = chosen ? contracts[chosen.type] : undefined;
  const textSettings = contract?.props.filter((p) => TEXT_KINDS.has(p.kind) && !p.binds) ?? [];
  const parts = contract?.parts ?? {};

  useEffect(() => {
    if (!textSettings.some((s) => s.name === setting)) setSetting(textSettings[0]?.name ?? "");
  }, [textSettings, setting]);
  useEffect(() => {
    if (part !== "root" && !parts[part]) setPart(Object.keys(parts).find((p) => parts[p]!.prop) ?? "root");
  }, [parts, part]);
  useEffect(() => {
    const v = chosen && setting ? chosen.node.props[setting] : "";
    setText(typeof v === "string" ? v : "");
  }, [chosen, setting]);

  const send = (steps: unknown[], by: Entry["by"]) => {
    const out = applySteps(doc, steps, { contracts, config, allowUnknownTypes: true });
    const last = out.results[out.results.length - 1];
    const say = out.ok ? (out.results.map((r) => r.say).join(" ") || "Done.") : (last?.say ?? "That was not accepted.");
    setLedger((l) => [{ n: (l[0]?.n ?? 0) + 1, by, ok: out.ok, say }, ...l].slice(0, 12));
    if (out.ok && out.results.some((r) => r.side)) onPending([...pending, ...(steps as Step[])]);
  };

  const lookStep = (look: Record<string, unknown> | null): Step => ({
    op: "set_look",
    block: blockId,
    part,
    look,
    ...(when ? { state: when } : {}),
    ...(screen ? { at: screen } : {}),
  });

  const sendScript = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script);
    } catch {
      setLedger((l) => [{ n: (l[0]?.n ?? 0) + 1, by: "Assistant" as const, ok: false, say: "That is not valid JSON, so nothing was sent." }, ...l].slice(0, 12));
      return;
    }
    send(Array.isArray(parsed) ? parsed : [parsed], "Assistant");
  };

  const here = places.find((p) => p.zone === zone);
  const wantedIndex = index.trim() === "" ? undefined : Number(index);
  const indexOk = wantedIndex === undefined || (Number.isInteger(wantedIndex) && wantedIndex >= 0);

  // The page may be empty: the Blocks hand is how its first block is added.
  if (choices.length === 0 && hand !== "blocks") {
    return (
      <div className="st-hands">
        <p className="st-note">There is no block on this page to change yet.</p>
        <button type="button" onClick={() => setHand("blocks")}>
          Add the first block
        </button>
      </div>
    );
  }

  const example = chosen && textSettings[0] ? JSON.stringify([{ op: "set_prop", block: chosen.id, prop: textSettings[0].name, value: "Words from an assistant" }], null, 1) : "";

  return (
    <div className="st-hands">
      {hand === "words" || hand === "look" ? (
        <label className="st-field">
          <span>Block</span>
          <select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
            {choices.map((c) => (
              <option key={c.path} value={c.id}>
                {"- ".repeat(c.depth)}
                {contracts[c.type]?.label ?? c.type} ({c.id})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="st-tabs" role="tablist">
        {(["words", "look", "blocks", "assistant"] as const).map((h) => (
          <button key={h} type="button" role="tab" aria-selected={hand === h} onClick={() => setHand(h)}>
            {h === "words" ? "Words" : h === "look" ? "Look" : h === "blocks" ? "Blocks" : "Assistant"}
          </button>
        ))}
      </div>

      {hand === "words" ? (
        textSettings.length === 0 ? (
          <p className="st-note">This block has no plain text setting to type into.</p>
        ) : (
          <div className="st-row">
            <label className="st-field">
              <span>Setting</span>
              <select value={setting} onChange={(e) => setSetting(e.target.value)}>
                {textSettings.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field st-grow">
              <span>Words</span>
              <textarea value={text} rows={3} onChange={(e) => setText(e.target.value)} />
            </label>
            <button type="button" onClick={() => send([{ op: "set_prop", block: blockId, prop: setting, value: text }], "Words")}>
              Change the words
            </button>
          </div>
        )
      ) : null}

      {hand === "look" ? (
        <div className="st-row">
          <label className="st-field">
            <span>Part</span>
            <select value={part} onChange={(e) => setPart(e.target.value)}>
              {Object.entries(parts).map(([name, p]) => (
                <option key={name} value={name}>
                  {p.label}
                </option>
              ))}
              {!parts.root ? <option value="root">The whole block</option> : null}
            </select>
          </label>
          {placed ? (
            <>
              <label className="st-field">
                <span>When</span>
                <select
                  value={when}
                  onChange={(e) => {
                    setWhen(e.target.value as typeof when);
                    if (e.target.value) setScreen("");
                  }}
                >
                  {WHENS.map((w) => (
                    <option key={w.v} value={w.v}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="st-field">
                <span>Screen</span>
                <select
                  value={screen}
                  onChange={(e) => {
                    setScreen(e.target.value as typeof screen);
                    if (e.target.value) setWhen("");
                  }}
                >
                  {SCREENS.map((w) => (
                    <option key={w.v} value={w.v}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <div className="st-field">
            <span>Colour of the words</span>
            <div className="st-swatches">
              {PIGMENTS.map((p) => (
                <button key={p.hex} type="button" title={p.name} aria-label={p.name} style={{ background: p.hex }} onClick={() => send([lookStep({ color: p.hex })], "Look")} />
              ))}
            </div>
          </div>
          <label className="st-field">
            <span>Weight</span>
            <select defaultValue="" onChange={(e) => e.target.value && send([lookStep({ weight: Number(e.target.value) })], "Look")}>
              <option value="">Choose</option>
              {WEIGHTS.map((w) => (
                <option key={w.v} value={w.v}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => send([lookStep(null)], "Look")}>
            Clear this part&rsquo;s look
          </button>
          {placed ? <p className="st-note">A look set for one situation (hovered, focused, pressed) or one screen size is kept next to the part&rsquo;s ordinary look; it does not replace it.</p> : null}
        </div>
      ) : null}

      {hand === "blocks" ? (
        <div className="st-blocks">
          <div className="st-row">
            <label className="st-field">
              <span>Add a block</span>
              <select value={addType} onChange={(e) => setAddType(e.target.value)}>
                {allTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({t.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>Where</span>
              <select value={zone} onChange={(e) => setZone(e.target.value)}>
                {places.map((p) => (
                  <option key={p.zone} value={p.zone}>
                    {p.label} ({p.size} there now)
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>Position (0 is first; empty is last)</span>
              <input type="number" min={0} value={index} onChange={(e) => setIndex(e.target.value)} />
            </label>
            <button type="button" disabled={!addType || !indexOk} onClick={() => send([{ op: "insert", type: addType, zone, ...(wantedIndex !== undefined ? { index: wantedIndex } : {}) }], "Blocks")}>
              Add it
            </button>
          </div>
          {choices.length ? (
            <div className="st-row">
              <label className="st-field">
                <span>Block</span>
                <select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
                  {choices.map((c) => (
                    <option key={c.path} value={c.id}>
                      {"- ".repeat(c.depth)}
                      {contracts[c.type]?.label ?? c.type} ({c.id})
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={!blockId || wantedIndex === undefined || !indexOk} title="Uses the Where and Position above" onClick={() => send([{ op: "move", block: blockId, zone, index: wantedIndex }], "Blocks")}>
                Move it to the place and position above
              </button>
              <button type="button" disabled={!blockId} onClick={() => send([{ op: "duplicate", block: blockId }], "Blocks")}>
                Copy it
              </button>
              <button type="button" disabled={!blockId} onClick={() => send([{ op: "remove", block: blockId }], "Blocks")}>
                Remove it
              </button>
            </div>
          ) : null}
          <p className="st-note">{here ? `${here.label} holds ${here.size} block${here.size === 1 ? "" : "s"}. ` : ""}A place that does not take a kind of block says so. Nothing is final until you save as a draft and publish.</p>
        </div>
      ) : null}

      {hand === "assistant" ? (
        <div className="st-field">
          <span>Steps (JSON, one or a list)</span>
          <textarea value={script} rows={5} placeholder={example} onChange={(e) => setScript(e.target.value)} spellCheck={false} />
          <div className="st-actions">
            <button type="button" onClick={sendScript} disabled={!script.trim()}>
              Send the steps
            </button>
            {example ? (
              <button type="button" onClick={() => setScript(example)}>
                Fill in an example
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {ledger.length ? (
        <ul className="st-ledger" aria-live="polite">
          {ledger.map((e) => (
            <li key={e.n} className={e.ok ? "st-ok" : "st-bad"}>
              <b>{e.by}</b> {e.ok ? "accepted:" : "refused:"} {e.say}
            </li>
          ))}
        </ul>
      ) : null}
      {pending.length ? <p className="st-note">{pending.length} change{pending.length === 1 ? "" : "s"} not saved yet.</p> : null}
    </div>
  );
}
