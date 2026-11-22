import type { SectionNote } from "@elkdonis/services/section-notes";

/**
 * "More details" under a meeting's body: the row notes the author added in the form
 * (threads.metadata.sectionNotes), one piece per note, labelled by its row. Plain text rendered
 * as React text (no HTML), line breaks kept. Draws nothing without notes.
 * Audience: the caller only has notes after getThreadBySlug's mayRead check, so they reach the same
 * people as the piece.
 */
export function MoreDetails({ notes }: { notes: SectionNote[] | undefined }) {
  if (!notes || notes.length === 0) return null;
  return (
    <section className="eac-surface-section" style={{ marginTop: 24 }} aria-label="More details">
      <h3>More details</h3>
      <div style={{ display: "grid", gap: 14 }}>
        {notes.map((n) => (
          <div key={n.section}>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--feed, hsl(var(--primary)))",
              }}
            >
              {n.label}
            </div>
            <p style={{ margin: "4px 0 0", whiteSpace: "pre-line", lineHeight: 1.55 }}>{n.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
