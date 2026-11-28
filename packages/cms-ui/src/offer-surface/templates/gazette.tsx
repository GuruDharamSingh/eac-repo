"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { useOfferEnv } from "../env";
import { offerDescriptor } from "../descriptor";
import { PersonName } from "../layers-people";
import { OstBody } from "./body";
import { TemplateShell } from "./shell";
import type { TemplateData, TemplateProps } from "./types";

// Packet frame 2l, natural height. The masthead replaces the nav bar (passed as
// TemplateShell's `top`), with Profile and + Follow kept in it. Index becomes
// "Also in this issue". Entries open the reading surface (wr-read); the author name opens
// pf-owner. Masthead Profile stays a link (the one allowed way off the page).

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function Masthead({ data }: { data: TemplateData }) {
  const { open } = useSurface();
  const env = useOfferEnv();
  const following = env.isFollowing(data.owner.id);
  const piece = data.pieces[0];
  const d = piece?.date ? new Date(piece.date) : null;
  const dateLine = d ? `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
  return (
    <header className="ost-gaz-mast">
      <div className="ost-gaz-line">
        <span className="ost-gaz-date">{dateLine}</span>
        <span className="ost-top-links">
          <a className="ost-toplink" href="/profile">Profile</a>
          <button
            type="button"
            className={`ost-toplink is-follow${following ? " is-on" : ""}`}
            onClick={(e) => open(following ? offerDescriptor("pf-owner", data.owner.id) : offerDescriptor("follow", data.owner.id, { flow: "fol" }), e.currentTarget)}
          >
            {following ? "✓ Following" : "+ Follow"}
          </button>
        </span>
      </div>
      <div className="ost-gaz-name">{data.site.name}</div>
      <div className="ost-gaz-meta">
        <span>{(piece?.series ?? "").toUpperCase()}</span>
        <span>{piece?.n ? `NO. ${piece.n}` : ""}</span>
        <span>{piece?.minutes ? `${piece.minutes} MIN` : ""}</span>
      </div>
    </header>
  );
}

export function GazetteTemplate({ data }: TemplateProps) {
  const { open } = useSurface();
  const piece = data.pieces[0];
  const more = data.pieces.slice(1, 4);
  const authorId = piece?.authorId || data.owner.id;
  const author = data.people[authorId] ?? data.owner;
  return (
    <TemplateShell data={data} template="gazette" top={<Masthead data={data} />}>
      {piece && (
        <article className="ost-gaz">
          <h1 className="ost-gaz-title">{piece.title}</h1>
          {piece.standfirst && <p className="ost-gaz-deck">{piece.standfirst}</p>}
          <span className="ost-gaz-by">By <PersonName id={author.id} className="ost-gaz-author">{author.name}</PersonName></span>
          {(piece.picture || data.placeholders) && (
            <div className={`ost-gaz-pic${piece.picture ? " is-real" : " osf-ph"}`}>{piece.picture ? <img src={piece.picture} alt={piece.caption ?? ""} /> : "picture · above the fold"}</div>
          )}
          {/* Trusted sample HTML; the host must pass sanitised HTML. */}
          {piece.bodyHtml && <OstBody className="ost-gaz-cols" data={data} html={piece.bodyHtml} />}
          {more.length > 0 && (
            <footer className="ost-gaz-also">
              {more.map((p, i) => {
                const inner = (
                  <>
                    {i === 0 && <span className="ost-gaz-also-h">Also in this issue</span>}
                    <span className="ost-gaz-also-t">{p.title}</span>
                  </>
                );
                return (
                  <button key={p.key} type="button" className="ost-gaz-also-i" onClick={(e) => open(offerDescriptor("wr-read", p.key), e.currentTarget)}>{inner}</button>
                );
              })}
            </footer>
          )}
        </article>
      )}
    </TemplateShell>
  );
}
