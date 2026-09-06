import { EnneagramDiagram } from "@/components/enneagram/EnneagramDiagram";
import { EnneagramSection } from "@/components/enneagram/EnneagramSection";
import { CentersDiagram } from "@/components/enneagram/CentersDiagram";
import { SiteNav } from "@/components/site-nav";

export const metadata = {
  title: "Centers & Triads",
  description:
    "The three centers of intelligence and the triads that group the nine types.",
};

export default function EnneagramPage() {
  return (
    <>
    <SiteNav />
    <main
      style={{
        backgroundColor: "#0a0a0c",
        color: "#ece7dd",
        minHeight: "100vh",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
      }}
    >
      {/* ── Hero: full interactive diagram ───────────────────────── */}
      <section className="py-20 px-6 text-center">
        <p
          className="text-xs tracking-[0.3em] uppercase mb-5"
          style={{ color: "#3aa99c" }}
        >
          A map of nine fixations
        </p>
        <h1
          className="text-5xl md:text-6xl mb-4"
          style={{ fontWeight: 400, color: "#ece7dd" }}
        >
          The Enneagram
        </h1>
        <p
          className="max-w-lg mx-auto text-base mb-14"
          style={{ color: "rgba(236,231,221,0.55)", lineHeight: 1.8 }}
        >
          Nine ways the psyche contracts around a core wound. Click any point to
          explore a type. Use the toggles to reveal the geometric relationships
          between them.
        </p>

        <div className="max-w-md mx-auto">
          <EnneagramDiagram showControls />
        </div>
      </section>

      <Divider />

      {/* ── Centers of Intelligence ───────────────────────────────── */}
      <section className="py-16 px-6">
        <h2
          className="text-3xl md:text-4xl text-center mb-10"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: "#ece7dd",
            fontWeight: 400,
          }}
        >
          Three Centers
        </h2>
        <div className="flex flex-col md:flex-row gap-10 items-center max-w-5xl mx-auto">
          {/* Text */}
          <div className="flex-1 min-w-0">
            <SectionLabel color="#3aa99c">Body · Heart · Head</SectionLabel>
            <h3 style={h3Style}>Where awareness lives</h3>
            <p style={bodyStyle}>
              The nine types organize into three centers of intelligence. The{" "}
              <Emphasis color="#3aa99c">Body center</Emphasis> — types 1, 8,
              and 9 — processes experience through instinct, boundary, and
              physical presence. The{" "}
              <Emphasis color="#d97070">Heart center</Emphasis> — types 2, 3,
              and 4 — navigates through feeling, image, and relational meaning.
              The <Emphasis color="#8f83c0">Head center</Emphasis> — types 5,
              6, and 7 — makes sense of experience through thinking, planning,
              and analysis.
            </p>
            <p style={bodyStyle}>
              Each center has one type that over-expresses its energy (8, 4,
              7), one that under-expresses it (9, 2, 5), and one that swings
              between the two (1, 3, 6). The center a type belongs to describes
              its habitual domain of contraction — not necessarily its most
              developed capacity.
            </p>
            <CenterKey />
          </div>
          {/* Specialized centers diagram */}
          <div className="w-full md:max-w-xs lg:max-w-sm flex-shrink-0">
            <CentersDiagram />
          </div>
        </div>
      </section>

      <Divider />

      {/* ── Harmony Triad 3-6-9 ──────────────────────────────────── */}
      <EnneagramSection
        title="The Harmony Triad"
        highlightPoints={[3, 6, 9]}
        activeLineGroups={["369"]}
        diagramSide="left"
      >
        <SectionLabel color="#c8a54e">3 · 6 · 9</SectionLabel>
        <h3 style={h3Style}>The inner triangle</h3>
        <p style={bodyStyle}>
          Types 3, 6, and 9 form the equilateral triangle at the center of the
          diagram. They are sometimes called the <em>image</em> types or the{" "}
          <em>shock points</em> — each sits at the pivot of one of the three
          centers and carries the central organizing anxiety of that center in its
          most fundamental form.
        </p>
        <p style={bodyStyle}>
          <Emphasis color="#c8a54e">Type 9</Emphasis> is the apex: the Peacemaker
          who forgets the self entirely, falling asleep to their own presence.{" "}
          <Emphasis color="#c8a54e">Type 3</Emphasis> inverts this: hyperactive
          self-construction through image and role.{" "}
          <Emphasis color="#c8a54e">Type 6</Emphasis> oscillates — loyal to
          structures that promise security, but perpetually doubting whether they
          can be trusted.
        </p>
        <p style={bodyStyle}>
          Together they reveal the three faces of a single problem: the
          relationship between self and world when the self cannot be taken for
          granted.
        </p>
      </EnneagramSection>

      <Divider />

      {/* ── Frustration Triad 1-4-7 ──────────────────────────────── */}
      <EnneagramSection
        title="The Frustration Triad"
        highlightPoints={[1, 4, 7]}
        activeLineGroups={["147"]}
        diagramSide="right"
      >
        <SectionLabel color="#3aa99c">1 · 4 · 7</SectionLabel>
        <h3 style={h3Style}>Seeking what is missing</h3>
        <p style={bodyStyle}>
          Types 1, 4, and 7 share a structural orientation toward{" "}
          <em>something that is not yet here</em>. They are called the frustration
          triad because each is organized around a gap between what is and what
          should be — and each manages that gap differently.
        </p>
        <p style={bodyStyle}>
          <Emphasis color="#3aa99c">Type 1</Emphasis> turns toward the outer world
          and tries to correct it. <Emphasis color="#3aa99c">Type 4</Emphasis>{" "}
          turns inward and mourns what is missing in the self. Type{" "}
          <Emphasis color="#3aa99c">7</Emphasis> turns toward the future and fills
          the gap with plans, options, and anticipation.
        </p>
        <p style={bodyStyle}>
          The frustration is rarely conscious as frustration. It feels like
          discernment, depth, or enthusiasm. The work for each type is recognizing
          that the gap they are organized around is not a problem to be solved but
          a premise to be examined.
        </p>
      </EnneagramSection>

      <Divider />

      {/* ── Rejection Triad 2-5-8 ────────────────────────────────── */}
      <EnneagramSection
        title="The Rejection Triad"
        highlightPoints={[2, 5, 8]}
        activeLineGroups={["258"]}
        diagramSide="left"
      >
        <SectionLabel color="#d97070">2 · 5 · 8</SectionLabel>
        <h3 style={h3Style}>Navigating need and contact</h3>
        <p style={bodyStyle}>
          Types 2, 5, and 8 are organized around the experience of having their
          needs — or their right to have needs — rejected early in life. Each
          developed a distinct strategy in response.
        </p>
        <p style={bodyStyle}>
          <Emphasis color="#d97070">Type 2</Emphasis> learned that their own needs
          were not welcome, so they moved toward others and became indispensable.{" "}
          <Emphasis color="#d97070">Type 5</Emphasis> learned that engagement
          depleted them, and withdrew to manage what little energy they had.{" "}
          <Emphasis color="#d97070">Type 8</Emphasis> learned that vulnerability
          invited betrayal, and armored themselves with force.
        </p>
        <p style={bodyStyle}>
          Underneath these three very different presentations is the same wound:
          the conviction that contact with others — real, undefended contact —
          is unsafe or impossible.
        </p>
      </EnneagramSection>

      <Divider />

      {/* ── Inner Hexagram ────────────────────────────────────────── */}
      <EnneagramSection
        title="The Inner Hexagram"
        highlightPoints={[1, 2, 4, 5, 7, 8]}
        activeLineGroups={["hexagram"]}
        diagramSide="right"
      >
        <SectionLabel color="#8f83c0">1 · 4 · 2 · 8 · 5 · 7</SectionLabel>
        <h3 style={h3Style}>Lines of movement</h3>
        <p style={bodyStyle}>
          The six remaining types — 1, 2, 4, 5, 7, and 8 — form the inner
          hexagram through the path{" "}
          <Emphasis color="#8f83c0">1→4→2→8→5→7→1</Emphasis>. These lines
          describe the directions of integration and disintegration: the
          psychological movement that occurs under stress and under growth.
        </p>
        <p style={bodyStyle}>
          In stress, each type moves toward the less healthy expressions of the
          type it points <em>from</em>. In growth, it moves toward the healthier
          qualities of the type it points <em>to</em>. These are not destinations
          but directions — observable patterns in behavior when internal resources
          contract or expand.
        </p>
        <p style={bodyStyle}>
          The hexagram and triangle together form the complete figure: a map not
          just of nine fixed types but of nine fields of movement, each in
          relation to every other.
        </p>
      </EnneagramSection>

      <Divider />

      {/* ── Footer spacer ─────────────────────────────────────────── */}
      <div className="py-20 text-center">
        <p
          className="text-xs tracking-widest uppercase"
          style={{ color: "rgba(236,231,221,0.2)" }}
        >
          The Hidden Enneagram
        </p>
      </div>
    </main>
    </>
  );
}

// ── Small shared primitives ────────────────────────────────────────────────

function Divider() {
  return (
    <div className="max-w-2xl mx-auto px-6">
      <hr style={{ borderColor: "rgba(236,231,221,0.08)" }} />
    </div>
  );
}

function SectionLabel({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className="text-xs tracking-[0.25em] uppercase mb-3"
      style={{ color }}
    >
      {children}
    </p>
  );
}

function Emphasis({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return <span style={{ color, fontStyle: "italic" }}>{children}</span>;
}

function CenterKey() {
  const centers = [
    { label: "Body center", types: "1, 8, 9", color: "#3aa99c" },
    { label: "Heart center", types: "2, 3, 4", color: "#d97070" },
    { label: "Head center", types: "5, 6, 7", color: "#8f83c0" },
  ];
  return (
    <div className="flex flex-wrap gap-4 mt-6">
      {centers.map(({ label, types, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-xs"
            style={{ color: "rgba(236,231,221,0.6)" }}
          >
            {label} · {types}
          </span>
        </div>
      ))}
    </div>
  );
}

const h3Style: React.CSSProperties = {
  fontSize: "clamp(1.4rem, 2.5vw, 2rem)",
  fontWeight: 400,
  color: "#ece7dd",
  marginBottom: "1rem",
  lineHeight: 1.2,
};

const bodyStyle: React.CSSProperties = {
  fontSize: "clamp(0.9rem, 1.2vw, 1rem)",
  lineHeight: 1.85,
  color: "rgba(236,231,221,0.7)",
  marginBottom: "1rem",
};
