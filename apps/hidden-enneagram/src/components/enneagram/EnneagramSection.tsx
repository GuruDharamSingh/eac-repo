import { EnneagramDiagram } from "./EnneagramDiagram";
import type { LineGroup } from "./enneagram-data";

interface EnneagramSectionProps {
  children: React.ReactNode;
  /** Which types to highlight on the diagram for this section */
  highlightPoints?: number[];
  /** Which line groups to draw in color */
  activeLineGroups?: LineGroup[];
  /** Which side the diagram sits on (defaults to right) */
  diagramSide?: "left" | "right";
  /** Optional section heading */
  title?: string;
  className?: string;
}

export function EnneagramSection({
  children,
  highlightPoints = [],
  activeLineGroups = [],
  diagramSide = "right",
  title,
  className = "",
}: EnneagramSectionProps) {
  return (
    <section className={`py-16 px-6 ${className}`}>
      {title && (
        <h2
          className="text-3xl md:text-4xl text-center mb-10"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: "hsl(var(--band-foreground))",
            fontWeight: 400,
          }}
        >
          {title}
        </h2>
      )}

      <div
        className={`flex flex-col md:flex-row gap-10 items-center max-w-5xl mx-auto ${
          diagramSide === "left" ? "md:flex-row-reverse" : ""
        }`}
      >
        {/* Text content */}
        <div className="flex-1 min-w-0">{children}</div>

        {/* Diagram */}
        <div className="w-full md:max-w-xs lg:max-w-sm flex-shrink-0">
          <EnneagramDiagram
            highlightPoints={highlightPoints}
            activeLineGroups={activeLineGroups}
          />
        </div>
      </div>
    </section>
  );
}
