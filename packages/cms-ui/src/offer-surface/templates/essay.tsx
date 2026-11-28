"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { offerDescriptor } from "../descriptor";
import { PersonName } from "../layers-people";
import { OstBody } from "./body";
import { TemplateShell } from "./shell";
import type { TemplateProps, TemplatePiece } from "./types";

// Packet frame 2g. Index rail with the piece's own sections lighting up, a
// bronze progress line under the nav, drop cap, asterism, centred pull quote.
// The text pane (ost-scroll) scrolls; the page does not.
// Other pieces open the reading surface (wr-read); "Open the talk" opens talk; the
// author name opens pf-owner. "All writing" is drawn and inert (nothing navigates away).

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function dayMonth(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

export function EssayTemplate({ data }: TemplateProps) {
  const piece: TemplatePiece | undefined = data.pieces[0];
  // The index: its series neighbours first, then the newest, about 8 in all ("All writing" opens the rest).
  const others = React.useMemo(() => {
    const rest = data.pieces.slice(1);
    const near = piece?.series ? rest.filter((p) => p.series === piece.series) : [];
    return [...near, ...rest.filter((p) => !near.includes(p))].slice(0, 8);
  }, [data.pieces, piece]);
  const authorId = piece?.authorId || data.owner.id;
  const author = data.people[authorId] ?? data.owner;
  const before = others.slice(0, Math.ceil(others.length / 2));
  const after = others.slice(before.length);
  const sections = React.useMemo(
    () => (piece?.sections?.length ? piece.sections : piece?.bodyHtml ? [{ id: "text", title: "", html: piece.bodyHtml }] : []),
    [piece],
  );
  const { open } = useSurface();
  const pane = React.useRef<HTMLDivElement>(null);
  const [progress, setProgress] = React.useState(0);
  const [active, setActive] = React.useState(sections[0]?.id ?? "");

  // Desktop: the text pane scrolls (as 2g draws it). Phone: the pane grows to its text and
  // the page scrolls, so progress and the lit section follow the window instead.
  const onScroll = React.useCallback(() => {
    const el = pane.current;
    if (!el) return;
    const inner = el.scrollHeight - el.clientHeight > 1;
    const box = el.getBoundingClientRect();
    const view = inner ? el.clientHeight : window.innerHeight;
    const max = inner ? el.scrollHeight - el.clientHeight : box.height - view;
    const at = inner ? el.scrollTop : -box.top;
    setProgress(max > 0 ? Math.min(1, Math.max(0, at / max)) : 0);
    const top = inner ? box.top : 0;
    let cur = sections[0]?.id ?? "";
    for (const s of sections) {
      const n = el.querySelector<HTMLElement>(`[data-sec="${s.id}"]`);
      if (n && n.getBoundingClientRect().top - top <= view * 0.35) cur = s.id;
    }
    if (max > 0 && at >= max - 4) cur = sections[sections.length - 1]?.id ?? cur;
    setActive(cur);
  }, [sections]);
  React.useEffect(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const jump = (id: string) => {
    const el = pane.current;
    const n = el?.querySelector<HTMLElement>(`[data-sec="${id}"]`);
    if (!el || !n) return;
    if (el.scrollHeight - el.clientHeight > 1) el.scrollTo({ top: n.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12, behavior: "smooth" });
    else window.scrollTo({ top: n.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
  };

  const entry = (p: TemplatePiece) => (
    <button key={p.key} type="button" className="ost-essay-link" onClick={(e) => open(offerDescriptor("wr-read", p.key), e.currentTarget)}>{p.title}</button>
  );

  if (!piece) return <TemplateShell data={data} template="essay"><div className="ost-essay" /></TemplateShell>;

  return (
    <TemplateShell data={data} template="essay">
      <div className="ost-essay">
        <div className="ost-essay-bar" aria-hidden><i style={{ width: `${progress * 100}%` }} /></div>
        <div className="ost-essay-grid">
          <nav className="ost-essay-rail" aria-label="Index">
            <span className="ost-essay-rail-h">Index</span>
            {before.map(entry)}
            <span className="ost-essay-link is-now">This piece</span>
            <div className="ost-essay-subs">
              {sections.filter((s) => s.title).map((s) => (
                <button key={s.id} type="button" className={`ost-essay-sub${active === s.id ? " is-on" : ""}`} onClick={() => jump(s.id)}>{s.title}</button>
              ))}
            </div>
            {after.map(entry)}
            <button type="button" className="ost-essay-all" onClick={(e) => open(offerDescriptor("wr-read", piece.key), e.currentTarget)}>All writing →</button>
          </nav>
          <div className="ost-essay-pane ost-scroll" ref={pane} onScroll={onScroll}>
            <div className="ost-essay-col">
              <span className="ost-essay-kick">{[piece.series, "Essay"].filter(Boolean).join(" · ")}</span>
              <h1 className="ost-essay-title">{piece.title}</h1>
              {piece.standfirst && <p className="ost-essay-stand">{piece.standfirst}</p>}
              <div className="ost-essay-by">
                {author.portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="ost-essay-av" src={author.portrait} alt="" />
                ) : (
                  <i className="ost-essay-av" />
                )}
                <PersonName id={author.id} className="ost-essay-name">{author.name}</PersonName>
                <span className="ost-essay-meta">{[dayMonth(piece.date), piece.minutes ? `${piece.minutes} MIN` : ""].filter(Boolean).join(" · ")}</span>
              </div>
              <i className="ost-essay-rule" />
              {sections.map((s, i) => (
                <React.Fragment key={s.id}>
                  {i > 0 && <div className="ost-essay-ast" aria-hidden>⁂</div>}
                  <section data-sec={s.id} className={`ost-essay-sec${i === 0 ? " is-first" : ""}`}>
                    {i > 0 && s.title && <h2 className="ost-essay-h2">{s.title}</h2>}
                    {/* Trusted sample HTML; the host must pass sanitised HTML. */}
                    <OstBody className="ost-essay-body" data={data} html={s.html} />
                  </section>
                  {i === 0 && (
                    <>
                      {piece.picture ? (
                        <div className="ost-essay-pic is-real"><img src={piece.picture} alt={piece.caption ?? ""} /></div>
                      ) : (
                        data.placeholders && <div className="ost-essay-pic osf-ph">picture · text width</div>
                      )}
                      {piece.picture && piece.caption && <span className="ost-essay-cap">{piece.caption}</span>}
                    </>
                  )}
                  {i === 1 && piece.pullQuote && <blockquote className="ost-essay-pull">“{piece.pullQuote}”</blockquote>}
                </React.Fragment>
              ))}
              <div className="ost-essay-foot">
                <span className="ost-essay-meta">{[data.extras.talkCount != null ? `${data.extras.talkCount} REPLIES` : "", others[0] ? `NEXT: ${others[0].title.toUpperCase()} →` : ""].filter(Boolean).join(" · ")}</span>
                <button type="button" className="osf-btn osf-btn-primary ost-essay-talk" onClick={(e) => open(offerDescriptor("talk", piece.key), e.currentTarget)}>Open the talk</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TemplateShell>
  );
}
