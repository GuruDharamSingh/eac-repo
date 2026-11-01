import "../microfiche.css";
import { ClassifiedsFonts } from "../fonts";
import { loadRealEntries } from "../reals";
import { tileAt, tileFromSection } from "@/classifieds/plane";
import { SECTIONS, TWISTS, twistsFor } from "@/classifieds/sections";
import { zonesIn } from "@/classifieds/zones";
import { TileView } from "@/classifieds/Sheet";
import { setReaderDials } from "@/classifieds/style";
import { setWorldSeed } from "@/classifieds/rng";
import { NEUTRAL, decodeDials } from "@/classifieds/dials";

export const dynamic = "force-dynamic";

/**
 * /classifieds/mockups: a static block of the continuous section for review
 * without driving the viewer. `?at=i,j&w=3&h=2` shows the w×h tiles from
 * (i, j), edge to edge, as the plane shows them; `&d=5555555555` sets the
 * ten dials and `&world=7` the seed.
 */
export default async function MockupsPage({ searchParams }: { searchParams: Promise<{ at?: string; w?: string; h?: string; d?: string; world?: string; section?: string; n?: string; twists?: string }> }) {
  const { at, w, h, d, world, section, n, twists } = await searchParams;
  if (section) {
    const sec = SECTIONS.find((x) => x.id === section);
    if (!sec) return <main className="cl-mockups"><p className="cl-block-caption">Sections: {SECTIONS.map((x) => x.id).join(", ")}. Twists: {TWISTS.map((t) => t.id).join(", ")}.</p></main>;
    setReaderDials({ ...NEUTRAL });
    setWorldSeed(0);
    const count = Math.min(30, Math.max(1, Number(n) || 12));
    const reals = await loadRealEntries();
    const fixed = twists ? twists.split(",").map((id) => TWISTS.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t) : null;
    return (
      <main className="cl-mockups" style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: 24 }}>
        <ClassifiedsFonts />
        {Array.from({ length: count }, (_, q) => {
          const tw = fixed ?? twistsFor((q + 1) / (count + 1));
          const t = tileFromSection(sec, tw, q);
          return (
            <figure key={q} style={{ margin: 0 }}>
              <div className="cl-block" style={{ width: t.w, height: t.h }}><TileView tile={{ ...t, x: 0, y: 0 }} /></div>
              <p className="cl-block-caption">{sec.label} · {tw.map((x) => x.label).join(" + ") || "plain"} · {t.grid.cols} cols · {sec.fonts.join(", ")}</p>
            </figure>
          );
        })}
        <p className="cl-block-caption" style={{ width: "100%" }}>{SECTIONS.map((x) => x.id).join(" · ")} — add &twists=a,b to fix the twists.</p>
      </main>
    );
  }
  const [i0, j0] = (at ?? "0,0").split(",").map(Number);
  const cols = Math.min(6, Math.max(1, Number(w) || 3));
  const rows = Math.min(4, Math.max(1, Number(h) || 2));
  // Module state on the server: set per request before generating (requests are handled one at a time per render).
  setReaderDials(decodeDials(d) ?? { ...NEUTRAL });
  setWorldSeed(parseInt(world ?? "0", 10) || 0);
  const reals = await loadRealEntries();
  const X0 = i0 * 1000, Y0 = j0 * 1400, X1 = X0 + cols * 1000, Y1 = Y0 + rows * 1400;
  const tiles = zonesIn(X0, Y0, X1 - 1, Y1 - 1, 40).map((z) => tileAt(z.r, z.k, reals));
  return (
    <main className="cl-mockups">
      <ClassifiedsFonts />
      <div className="cl-block" style={{ width: cols * 1000, height: rows * 1400 }}>
        {tiles.map((t) => (
          <TileView key={`${t.zone.r},${t.zone.k}`} tile={{ ...t, x: t.x - X0, y: t.y - Y0 }} />
        ))}
      </div>
      <p className="cl-block-caption">
        {tiles.map((t) => `zone ${t.zone.r},${t.zone.k} (${t.w}×${t.h}): ${t.style.anchors.mix.label} / ${t.grid.cols} cols / palette ${t.style.palette.id} / coherence ${Math.round(t.style.coherence * 100)}%`).join(" · ")}
      </p>
    </main>
  );
}
