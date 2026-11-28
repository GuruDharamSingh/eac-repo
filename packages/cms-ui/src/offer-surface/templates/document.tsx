"use client";

import * as React from "react";
import { OstBody } from "./body";
import { TemplateShell } from "./shell";
import type { TemplateProps } from "./types";

// Packet frame 2k, natural height. Contents rail, numbered sections, facts
// row, footnotes. "Download PDF" is drawn and inert. The footnote marker sits
// beside the section heading (section html is opaque, so it cannot go inline).

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function dayMonth(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

export function DocumentTemplate({ data }: TemplateProps) {
  const piece = data.pieces[0];
  const sections = React.useMemo(() => piece?.sections ?? [], [piece]);
  const [active, setActive] = React.useState(sections[0]?.id ?? "");
  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const nodes = sections.map((s) => document.getElementById(`ost-doc-${s.id}`)).filter(Boolean) as HTMLElement[];
    if (!nodes.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id.replace("ost-doc-", ""));
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [sections]);

  if (!piece) return <TemplateShell data={data} template="document"><div className="ost-doc" /></TemplateShell>;
  const notes = piece.footnotes ?? [];
  // The author, on a real page only (the sandbox mock has no byline).
  const byAuthor = !data.placeholders && piece.authorId ? (data.people[piece.authorId] ?? data.owner).name : "";

  return (
    <TemplateShell data={data} template="document">
      <div className="ost-doc" ref={root}>
        <nav className="ost-doc-rail" aria-label="Contents">
          <span className="ost-doc-rail-h">Contents</span>
          {sections.map((s, i) => (
            <a key={s.id} href={`#ost-doc-${s.id}`} className={`ost-doc-toc${active === s.id ? " is-on" : ""}`}>
              <span className="ost-doc-toc-n">{i + 1}</span>
              <span>{s.title || "Opening"}</span>
            </a>
          ))}
          <button type="button" className="osf-btn ost-doc-pdf" aria-disabled="true">↓ Download PDF</button>
        </nav>
        <div className="ost-doc-main">
          <div className="ost-doc-top">
            <span className="ost-doc-kick">Document</span>
            <span className="ost-doc-meta">{[byAuthor ? `BY ${byAuthor.toUpperCase()}` : "", piece.version?.toUpperCase(), piece.date ? `UPDATED ${dayMonth(piece.date)}` : ""].filter(Boolean).join(" · ")}</span>
          </div>
          <h1 className="ost-doc-title">{piece.title}</h1>
          {piece.facts && piece.facts.length > 0 && (
            <div className="ost-doc-facts">
              {piece.facts.map((f) => (
                <div key={f.label} className="ost-doc-fact">
                  <span className="ost-doc-fact-l">{f.label.toUpperCase()}</span>
                  <span className="ost-doc-fact-v">{f.value}</span>
                </div>
              ))}
            </div>
          )}
          {sections.map((s, i) => (
            <section key={s.id} id={`ost-doc-${s.id}`} className="ost-doc-sec">
              <span className="ost-doc-sec-n">{i + 1}</span>
              <div className="ost-doc-sec-b">
                {(s.title || notes[i]) && (
                  <h2 className="ost-doc-h2">
                    {s.title}
                    {notes[i] && <sup className="ost-doc-sup">{i + 1}</sup>}
                  </h2>
                )}
                {/* Trusted sample HTML; the host must pass sanitised HTML. */}
                <OstBody className="ost-doc-text" data={data} html={s.html} />
              </div>
            </section>
          ))}
          {notes.length > 0 && (
            <div className="ost-doc-notes">
              {notes.map((n, i) => (
                <div key={i}>{i + 1}. {n}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TemplateShell>
  );
}
