"use client";

import * as React from "react";
import Link from "next/link";
import { APPLIES, BUNDLES, CANVASES, DESIGNS, LOCAL_PAGES, type Design, type Frame } from "./manifest";
import "./design-handoffs.css";

// The design viewer: a side navigation over every design kept in apps/development/designs/
// (each plays live in an iframe, served by the gated route src/app/designs/[...path]/route.ts),
// the design pages built in this app, and the claude.ai canvases. Mounted at /designs (the
// "Designs" tab) and on the idea page /ideas/design-handoffs. A desktop design is scaled down
// to fit the column rather than cropped. The selection is kept in the hash (#d=<id>).

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const WIDTH: Record<Frame, number | null> = { phone: 390, tablet: 820, desktop: 1440, fill: null };
const HEIGHT: Record<Frame, number> = { phone: 844, tablet: 1000, desktop: 900, fill: 860 };
const FRAMES: Frame[] = ["phone", "tablet", "desktop", "fill"];

export const fileUrl = (bundle: string, file: string) =>
  `${BASE}/designs/${bundle}/${file.split("/").map(encodeURIComponent).join("/")}`;

function readHash(): string | null {
  try {
    const m = window.location.hash.match(/d=([\w-]+)/);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

export function DesignHandoffs() {
  const [id, setId] = React.useState<string>(DESIGNS[0]!.id);
  const design = DESIGNS.find((d) => d.id === id) ?? DESIGNS[0]!;
  const [frame, setFrame] = React.useState<Frame>(design.frame);
  const bundle = BUNDLES.find((b) => b.id === design.bundle)!;

  React.useEffect(() => {
    const fromHash = () => {
      const h = readHash();
      const d = h ? DESIGNS.find((x) => x.id === h) : undefined;
      if (d) {
        setId(d.id);
        setFrame(d.frame);
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function pick(d: Design) {
    setId(d.id);
    setFrame(d.frame);
    try {
      history.replaceState(null, "", `#d=${d.id}`);
    } catch {
      /* a blocked history API only loses the shareable hash */
    }
  }

  return (
    <div className="dh">
      <nav className="dh-nav" aria-label="Designs">
        {/* Phones: one select in place of the rail. */}
        <label className="dh-nav-select">
          <span>Design</span>
          <select value={design.id} onChange={(e) => pick(DESIGNS.find((d) => d.id === e.target.value)!)}>
            {BUNDLES.map((b) => (
              <optgroup key={b.id} label={b.title}>
                {DESIGNS.filter((d) => d.bundle === b.id).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="dh-rail">
          {BUNDLES.map((b) => (
            <section key={b.id} className="dh-rail-group">
              <h2>
                {b.title}
                <small>{b.received}</small>
              </h2>
              <ul>
                {DESIGNS.filter((d) => d.bundle === b.id).map((d) => (
                  <li key={d.id}>
                    <button type="button" aria-current={d.id === design.id ? "true" : undefined} onClick={() => pick(d)}>
                      <span>{d.title}</span>
                      <i className="dh-dot" data-built={d.built} title={d.built} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="dh-rail-group">
            <h2>Design pages in this app</h2>
            <ul>
              {LOCAL_PAGES.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} title={p.note}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="dh-rail-group">
            <h2>Canvases on claude.ai</h2>
            <ul>
              {CANVASES.map((g) => (
                <li key={g.area}>
                  <a href="#dh-canvases">{g.area}</a>
                </li>
              ))}
            </ul>
          </section>
          <p className="dh-legend">
            <i className="dh-dot" data-built="built" /> built <i className="dh-dot" data-built="partly" /> partly{" "}
            <i className="dh-dot" data-built="not built" /> not built <i className="dh-dot" data-built="reference" /> reference
          </p>
        </div>
      </nav>

      <div className="dh-main">
        <section className="dh-view" aria-label={design.title}>
          <p className="dh-crumb">
            {bundle.title} · {bundle.received} ·{" "}
            <a href={fileUrl(bundle.id, bundle.readme)} target="_blank" rel="noopener">
              README
            </a>
          </p>
          <header className="dh-view-head">
            <div>
              <h2>{design.title}</h2>
              <p className="dh-muted">{design.what}</p>
            </div>
            <div className="dh-tools">
              <div className="dh-seg" role="group" aria-label="Frame width">
                {FRAMES.map((f) => (
                  <button key={f} type="button" aria-pressed={frame === f} onClick={() => setFrame(f)}>
                    {f === "fill" ? "Fill" : `${f} ${WIDTH[f]}`}
                  </button>
                ))}
              </div>
              <a className="dh-btn" href={fileUrl(design.bundle, design.file)} target="_blank" rel="noopener">
                Open in a tab ↗
              </a>
              {design.doc && (
                <a className="dh-btn" href={fileUrl(design.bundle, design.doc)} target="_blank" rel="noopener">
                  Handoff doc
                </a>
              )}
            </div>
          </header>

          <Stage key={`${design.id}:${frame}`} src={fileUrl(design.bundle, design.file)} frame={frame} title={design.title} />

          <dl className="dh-facts">
            <dt>For</dt>
            <dd>{design.apps.join(" · ")}</dd>
            <dt>In the tree</dt>
            <dd>
              <span className="dh-chip" data-built={design.built}>
                {design.built}
              </span>{" "}
              {design.state}
            </dd>
            <dt>Fidelity</dt>
            <dd>
              {design.fidelity}
              {design.interactive ? " · plays (has working controls)" : ""}
            </dd>
            {design.code.length > 0 && (
              <>
                <dt>Code</dt>
                <dd>
                  {design.code.map((c) => (
                    <code key={c}>{c}</code>
                  ))}
                </dd>
              </>
            )}
            <dt>File</dt>
            <dd>
              <code>
                apps/development/designs/{design.bundle}/{design.file}
              </code>
            </dd>
          </dl>
        </section>

        <section>
          <h2>Where the publication motifs apply</h2>
          <div className="dh-table">
            <table>
              <thead>
                <tr>
                  <th>App</th>
                  <th>Motifs from the 2026-11-27 handoff</th>
                  <th>Today (source reading)</th>
                </tr>
              </thead>
              <tbody>
                {APPLIES.map((a) => (
                  <tr key={a.app}>
                    <td>{a.app}</td>
                    <td>{a.motifs}</td>
                    <td>{a.now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="dh-canvases">
          <h2>Canvases on claude.ai</h2>
          <p className="dh-muted">Published artifacts, private to the owner&apos;s account; they open on claude.ai and are not copied here.</p>
          <div className="dh-canvases">
            {CANVASES.map((g) => (
              <div key={g.area} className="dh-canvas-group">
                <h3>{g.area}</h3>
                <ul>
                  {g.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noopener">
                        {l.title} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** The iframe at its design width, scaled to the column when wider. */
function Stage({ src, frame, title }: { src: string; frame: Frame; title: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [avail, setAvail] = React.useState(0);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = WIDTH[frame];
  const h = HEIGHT[frame];
  const scale = w && avail ? Math.min(1, avail / w) : 1;
  return (
    <div ref={box} className="dh-stage" data-frame={frame} style={{ height: Math.round(h * scale) + 2 }}>
      <iframe
        title={title}
        src={src}
        style={
          w
            ? { width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left", left: Math.max(0, (avail - w * scale) / 2) }
            : { width: "100%", height: h, left: 0 }
        }
      />
    </div>
  );
}
