"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { offerDescriptor } from "../descriptor";
import { PersonName } from "../layers-people";
import { OstBody } from "./body";
import { TemplateShell } from "./shell";
import type { TemplateProps } from "./types";

// Packet frame 2h, at its own height as a normal scrolling page: full-bleed
// cover carrying the title, large standfirst, two-column intro, breakout
// picture, pull quote, "More writing" strip.
// "More writing" cards open the reading surface (wr-read); the author name opens pf-owner.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function dayMonth(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
}

export function FeatureTemplate({ data }: TemplateProps) {
  const { open } = useSurface();
  const piece = data.pieces[0];
  const more = data.pieces.slice(1, 4);
  const authorId = piece?.authorId || data.owner.id;
  const author = data.people[authorId] ?? data.owner;
  if (!piece) return <TemplateShell data={data} template="feature"><div className="ost-feature" /></TemplateShell>;
  // A real page: the body is its sections (the intro in two columns, the rest after the pull quote, each with its
  // heading). The sandbox keeps the mock: body html in columns, then the second section.
  const real = !data.placeholders && (piece.sections?.length ?? 0) > 0;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const secHtml = (x: { title: string; html: string }) => (x.title ? `<h2>${esc(x.title)}</h2>` : "") + x.html;
  const introHtml = real ? secHtml(piece.sections![0]!) : piece.bodyHtml;
  const rest = real ? piece.sections!.slice(1) : (piece.sections ?? []).slice(1);
  const rest_meta = [dayMonth(piece.date), piece.minutes ? `${piece.minutes} MIN READ` : ""].filter(Boolean).map((s) => ` · ${s}`).join("");

  return (
    <TemplateShell data={data} template="feature">
      <article className="ost-feature">
        <header className={`ost-feature-cover${piece.cover ? "" : data.placeholders ? " osf-ph" : " is-bare"}`} style={piece.cover ? { backgroundImage: `url(${piece.cover})` } : undefined}>
          {!piece.cover && data.placeholders && <span className="ost-feature-covertag">cover image · full bleed</span>}
          <div className="ost-feature-shade" />
          <div className="ost-feature-head">
            <span className="ost-feature-kick">{["Feature", piece.series].filter(Boolean).join(" · ")}</span>
            <h1 className="ost-feature-title">{piece.title}</h1>
            <span className="ost-feature-meta">
              <PersonName id={author.id} className="ost-feature-author">{author.name.toUpperCase()}</PersonName>
              {rest_meta}
            </span>
          </div>
        </header>
        <div className="ost-feature-body">
          {piece.standfirst && <p className="ost-feature-stand">{piece.standfirst}</p>}
          {/* Trusted sample HTML; the host must pass sanitised HTML. */}
          {introHtml && <OstBody className="ost-feature-cols" data={data} html={introHtml} />}
          {(piece.picture || data.placeholders) && (
            <figure className="ost-feature-break">
              <div className={`ost-feature-pic${piece.picture ? " is-real" : " osf-ph"}`}>{piece.picture ? <img src={piece.picture} alt={piece.caption ?? ""} /> : "picture · breaks out to the edges"}</div>
              {piece.picture && piece.caption && <figcaption>{piece.caption}</figcaption>}
            </figure>
          )}
          {piece.pullQuote && (
            <div className="ost-feature-pull">
              <span className="ost-feature-q" aria-hidden>“</span>
              <p>{piece.pullQuote}</p>
            </div>
          )}
          {(real ? rest : rest.slice(0, 1)).map((s) => (
            <OstBody key={s.id} className="ost-feature-text" data={data} html={real ? secHtml(s) : s.html} />
          ))}
          {more.length > 0 && (
            <footer className="ost-feature-more">
              <span className="ost-feature-more-h">More writing</span>
              <div className="ost-feature-cards">
                {more.map((p) => {
                  const inner = (
                    <>
                      {(p.cover || data.placeholders) && <div className={`ost-feature-thumb${p.cover ? "" : " osf-ph"}`} style={p.cover ? { backgroundImage: `url(${p.cover})` } : undefined} />}
                      <span className="ost-feature-card-t">{p.title}</span>
                      <span className="ost-feature-card-m">{[dayMonth(p.date), p.minutes ? `${p.minutes} MIN` : ""].filter(Boolean).join(" · ")}</span>
                    </>
                  );
                  return (
                    <button key={p.key} type="button" className="ost-feature-card" onClick={(e) => open(offerDescriptor("wr-read", p.key), e.currentTarget)}>{inner}</button>
                  );
                })}
              </div>
            </footer>
          )}
        </div>
      </article>
    </TemplateShell>
  );
}
