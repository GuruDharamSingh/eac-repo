// Playground for @elkdonis/gradients: the real control and renderer, one page.
// Build: node packages/gradients/playground/build.mjs  -> playground/dist/index.html
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PRESETS, gradientCss, cleanGradient, type GradientSpec } from "../src/index";
import { GradientBackground, GradientControl } from "../src/react/index";

const start = PRESETS.find((p) => p.id === "spectrum")!.spec;

function App() {
  const [spec, setSpec] = useState<GradientSpec | undefined>(start);
  const [tab, setTab] = useState<"css" | "json">("css");
  const clean = cleanGradient(spec);
  const out = tab === "css" ? (clean ? `background: ${gradientCss(clean)};` : "") : JSON.stringify(clean, null, 2);
  return (
    <div className="pg">
      <header className="pg-head">
        <p className="eyebrow">Elkdonis Arts Collective · @elkdonis/gradients</p>
        <h1>Gradient Lab</h1>
        <p className="lede">Background gradients for Puck blocks and the direct editor. Ramps are blended in OKLCH from the logo ink and the Bon pigments, written as plain CSS, with optional WebGL shaders and grain.</p>
      </header>
      <main className="pg-main">
        <section className="pg-stage">
          <GradientBackground value={spec} className="hero">
            <div className="hero-copy">
              <span className="mark">EAC</span>
              <span className="word">Elkdonis</span>
              <span className="sub">Arts Collective</span>
            </div>
          </GradientBackground>
          <div className="out">
            <div className="out-tabs" role="tablist">
              <button role="tab" aria-selected={tab === "css"} onClick={() => setTab("css")}>CSS</button>
              <button role="tab" aria-selected={tab === "json"} onClick={() => setTab("json")}>Stored value</button>
            </div>
            <pre>{out || "No gradient."}</pre>
          </div>
          <h2>Presets</h2>
          <div className="gallery">
            {PRESETS.map((p) => (
              <button key={p.id} className="tile" onClick={() => setSpec(p.spec)}>
                <GradientBackground value={{ ...p.spec, shader: "none" }} className="tile-art" />
                {p.spec.shader !== "none" && <em className="tile-flag">shader</em>}
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </section>
        <aside className="pg-panel" aria-label="Gradient controls">
          <GradientControl value={spec} onChange={setSpec} label="Background" />
        </aside>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
