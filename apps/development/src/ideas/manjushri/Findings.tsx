import type { ReactNode } from "react";
import seamsJson from "@/data/manjushri/seams.json";
import aestheticJson from "@/data/manjushri/aesthetic.json";
import manifestJson from "@/data/manjushri/manifest.json";

// ============================================================================
// What the three research lanes found (docs/open/MANJUSHRI_2026-11-20), drawn on
// the server from their data files: seams.json (Puck 's internals), aesthetic.json
// (the look layer) and manifest.json (fields, the block manifest, assistant tools).
// Refresh: copy the three files into src/data/manjushri/ and rebuild. Every reader
// here is loose on purpose: a missing key draws nothing, it does not take the page down.
// ============================================================================

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});
const rows = (v: unknown): Loose[] => (Array.isArray(v) ? v.map(rec) : []);
const s = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "");
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);

const STABILITY: Record<string, { label: string; tone: string; rank: number }> = {
  public: { label: "Documented", tone: "good", rank: 0 },
  semi: { label: "Exported, undocumented", tone: "mid", rank: 1 },
  internal: { label: "Internal", tone: "bad", rank: 2 },
};
const RISK: Record<string, { label: string; tone: string; rank: number }> = {
  low: { label: "Low risk", tone: "good", rank: 0 },
  medium: { label: "Some risk", tone: "mid", rank: 1 },
  high: { label: "High risk", tone: "bad", rank: 2 },
};
const FROM: Record<string, string> = { grapesjs: "GrapesJS", figma: "Figma", both: "Both" };
const HAVE: Record<string, string> = { none: "Not yet", partial: "In part", full: "Yes" };
const TIER: Record<string, string> = { read: "Read", draft: "Propose a change", act: "Act" };

function Tag({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span className="mjf-tag" data-tone={tone}>
      {children}
    </span>
  );
}

function Table({ head, children, empty }: { head: string[]; children: ReactNode[]; empty: string }) {
  if (!children.length) return <p className="mjf-empty">{empty}</p>;
  return (
    <div className="mjf-scroll">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Moves({ moves }: { moves: Loose[] }) {
  if (!moves.length) return null;
  return (
    <ol className="mjf-steps">
      {moves.map((m, i) => (
        <li key={i}>
          <div>
            <strong>{s(m.title)}</strong>
            <span>{s(m.what_justin_sees)}</span>
            {s(m.proof) ? <span> How we know nothing broke: {s(m.proof)}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Findings() {
  const seams = rows(Array.isArray(seamsJson) ? seamsJson : rec(seamsJson).seams).sort(
    (a, b) => (STABILITY[s(a.stability)]?.rank ?? 3) - (STABILITY[s(b.stability)]?.rank ?? 3) || (RISK[s(a.risk)]?.rank ?? 3) - (RISK[s(b.risk)]?.rank ?? 3),
  );
  const aesthetic = rec(aestheticJson);
  const capabilities = rows(aesthetic.capabilities);
  const formats = rows(aesthetic.formats);
  const cascade = rows(aesthetic.cascade).sort((a, b) => Number(a.order) - Number(b.order));
  const manifest = rec(manifestJson);
  const fieldSystems = rows(manifest.field_systems);
  const descriptor = rec(manifest.descriptor);
  const tools = rows(manifest.mcp_tools);
  const anchors = rows(manifest.lms_anchors);

  return (
    <div className="mjf">
      <h2>Where Puck can be made to follow</h2>
      <p>
        Puck was read from its shipped code, line by line. Each row is a place where our own editor can take a job away from Puck: its panels, its drag layer, its history, its saving. The safest are the ones Puck
        documents; the ones marked internal can move when Puck is upgraded.
      </p>
      <Table head={["Place", "What we can take over", "Standing", "Risk", "We use it today"]} empty="The Puck report is still being written. Its table appears here on the next refresh.">
        {seams.map((m, i) => (
          <tr key={i}>
            <td>
              <strong>{s(m.name)}</strong>
              <br />
              <code>{s(m.evidence)}</code>
            </td>
            <td>
              {s(m.what)}
              {s(m.v024) ? (
                <>
                  <br />
                  <code>In 0.24: {s(m.v024)}</code>
                </>
              ) : null}
            </td>
            <td>
              <Tag tone={STABILITY[s(m.stability)]?.tone}>{STABILITY[s(m.stability)]?.label ?? s(m.stability)}</Tag>
            </td>
            <td>
              <Tag tone={RISK[s(m.risk)]?.tone}>{RISK[s(m.risk)]?.label ?? s(m.risk)}</Tag>
              <br />
              {s(m.risk_note)}
            </td>
            <td>{s(m.house_use) && s(m.house_use) !== "unused" ? <code>{s(m.house_use)}</code> : "Not yet"}</td>
          </tr>
        ))}
      </Table>

      <h2>What the look editor has, and what it lacks</h2>
      <p>
        Measured against the two tools you named. GrapesJS stores a page as free HTML and CSS; Figma stores drawings. Ours stores block settings, so a page keeps working when its content changes. The third column says how
        each ability can exist without giving that up.
      </p>
      <Table head={["Ability", "Known from", "What is missing", "How it can exist as block data", "What a block's maker must declare"]} empty="No abilities listed.">
        {capabilities.map((c, i) => (
          <tr key={i}>
            <td>
              <span className="mjf-meter" data-have={s(c.have)} title={HAVE[s(c.have)] ?? ""}>
                <i />
                <i />
              </span>
              <strong>{s(c.name)}</strong>
              <br />
              {HAVE[s(c.have)] ?? s(c.have)}
            </td>
            <td>{FROM[s(c.from)] ?? s(c.from)}</td>
            <td>{s(c.missing)}</td>
            <td>{s(c.as_block_data)}</td>
            <td>{s(c.needs_from_block_author)}</td>
          </tr>
        ))}
      </Table>

      <h3>Where a look is stored today</h3>
      <p>The same idea, "how this looks", is kept in several shapes that do not know about each other. Bringing them under one reader is the first move.</p>
      <Table head={["Shape", "Kept in", "Reaches", "Changes by screen size", "Hover and focus", "In a sentence"]} empty="No formats listed.">
        {formats.map((f, i) => (
          <tr key={i}>
            <td>
              <strong>{s(f.name)}</strong>
            </td>
            <td>
              <code>{s(f.stored_in)}</code>
            </td>
            <td>{s(f.reaches)}</td>
            <td>{f.responsive === true ? "Yes" : "No"}</td>
            <td>{f.states === true ? "Yes" : "No"}</td>
            <td>{s(f.note)}</td>
          </tr>
        ))}
      </Table>

      <h3>Which look wins, in order</h3>
      <p>Later layers win over earlier ones. The last one is the safety check, which no layer can switch off.</p>
      <Table head={["Order", "Layer", "Comes from", "Today"]} empty="No order listed.">
        {cascade.map((c, i) => (
          <tr key={i}>
            <td>{s(c.order)}</td>
            <td>
              <strong>{s(c.layer)}</strong>
            </td>
            <td>{s(c.source)}</td>
            <td>{s(c.today) === "proposed" ? <Tag tone="mid">Proposed</Tag> : <code>{s(c.today)}</code>}</td>
          </tr>
        ))}
      </Table>
      <h3>First moves for the look</h3>
      <Moves moves={rows(aesthetic.moves)} />

      <h2>Words: one way to describe a field</h2>
      <p>
        A field is one value someone can change: a title, a price, a link. Today the repo describes fields in several separate ways, each with its own rules for who may save. These are the ones found.
      </p>
      <Table head={["Field system", "Kinds of value", "Kept in", "Saved through", "Who may save", "Used by"]} empty="No field systems listed.">
        {fieldSystems.map((f, i) => (
          <tr key={i}>
            <td>
              <strong>{s(f.name)}</strong>
              <br />
              <code>{s(f.declared_in)}</code>
              <br />
              {s(f.note)}
            </td>
            <td>{list(f.kinds).join(", ")}</td>
            <td>
              <code>{s(f.stored_in)}</code>
            </td>
            <td>
              <code>{s(f.saved_through)}</code>
            </td>
            <td>{s(f.gate)}</td>
            <td>{list(f.used_by).join(", ")}</td>
          </tr>
        ))}
      </Table>

      {rows(descriptor.fields).length ? (
        <>
          <h3>The proposed single description{s(descriptor.name) ? `: ${s(descriptor.name)}` : ""}</h3>
          <p>One description per field, which the block, the on-page editor, the forms and an assistant all read. Most of it is joined from what the code already declares.</p>
          <Table head={["It records", "Meaning", "Comes from"]} empty="">
            {rows(descriptor.fields).map((f, i) => (
              <tr key={i}>
                <td>
                  <strong>{s(f.key)}</strong>
                </td>
                <td>{s(f.meaning)}</td>
                <td>{s(f.derived_from) === "new" ? <Tag tone="mid">New</Tag> : <code>{s(f.derived_from)}</code>}</td>
              </tr>
            ))}
          </Table>
        </>
      ) : null}

      <h2>Assistants: what one could do on a page</h2>
      <p>
        The platform's assistant door (MCP) can only read today. These are the tools it would need to work on pages and blocks. A change an assistant proposes is a draft a person approves; it is checked against the block's own
        description, the way the steps in the demo above are.
      </p>
      <Table head={["Tool", "Kind", "Built", "It takes", "Checked against", "Why it is safe"]} empty="No tools listed.">
        {tools.map((t, i) => (
          <tr key={i}>
            <td>
              <code>{s(t.name)}</code>
            </td>
            <td>{TIER[s(t.tier)] ?? s(t.tier)}</td>
            <td>{t.exists === true ? <Tag tone="good">Live</Tag> : <Tag tone="mid">Proposed</Tag>}</td>
            <td>
              <code>{s(t.input)}</code>
            </td>
            <td>
              {s(t.validates_against)}
              {s(t.gate) ? (
                <>
                  <br />
                  Gate: {s(t.gate)}
                </>
              ) : null}
            </td>
            <td>{s(t.why_safe)}</td>
          </tr>
        ))}
      </Table>

      {anchors.length ? (
        <>
          <h3>How a lesson can point at a block</h3>
          <p>For the courses layer: what lets a lesson step say "change this heading", open the right editor there, and know it was done.</p>
          <Table head={["Anchor", "What it gives", "Today"]} empty="">
            {anchors.map((a, i) => (
              <tr key={i}>
                <td>
                  <strong>{s(a.id)}</strong>
                </td>
                <td>{s(a.what)}</td>
                <td>{s(a.exists) === "proposed" ? <Tag tone="mid">Proposed</Tag> : <code>{s(a.exists)}</code>}</td>
              </tr>
            ))}
          </Table>
        </>
      ) : null}
      <h3>First moves for words and assistants</h3>
      <Moves moves={rows(manifest.moves)} />
    </div>
  );
}
