"use client";

import * as React from "react";
import { dateBlock, fmtMoney, hasEnded, looksLikeHtml, offerIcsUrl } from "../format";
import { useNowMs } from "../ended";
import { useOpenOffer } from "../page";
import { OstBody } from "./body";
import { TemplateShell } from "./shell";
import type { TemplateProps } from "./types";

// Announcement page (packet frame 2j): ribbon, headline, one paragraph, three
// facts under a bronze rule, one action.

type Fact = { label: string; value: string; note?: string };

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function AnnouncementTemplate({ data }: TemplateProps) {
  const openOffer = useOpenOffer();
  const now = useNowMs();
  const f = data.featured;
  const x = data.extras;
  if (!f) {
    return (
      <TemplateShell data={data} template="announcement">
        <div className="ost-announcement-empty">Nothing to announce at the moment.</div>
      </TemplateShell>
    );
  }
  // Draws live until mounted, then switches, so the server and browser agree.
  const ended = now != null && hasEnded(f, now);
  const b = f.when?.start ? dateBlock(f.when.start, f.when.timeZone) : null;
  let facts: Fact[] = x.facts ?? [];
  if (facts.length === 0) {
    if (b) facts.push({ label: "When", value: `${cap(b.weekday)} ${b.day} ${cap(b.month)}`, note: b.time });
    if (f.venue?.name || f.venue?.online) facts.push({ label: "Where", value: f.venue?.name || "Online", note: f.venue?.address || undefined });
    if (f.kind !== "writing" || f.price) facts.push({ label: "Cost", value: f.price ? fmtMoney(f.price) : "Free", note: f.takeUp === "rsvp" && !ended ? "RSVP to hold a place" : undefined });
  }
  const text = f.standfirst || f.description || "";
  const place = [f.venue?.name, f.venue?.address].filter(Boolean).join(", ") || null;
  const ics = f.when?.start && !ended ? offerIcsUrl({ uid: f.key, title: f.title, startIso: f.when.start, minutes: f.durationMinutes, location: place }) : null;
  // A piece of writing announced: the standfirst and one action ("Read it"); the piece itself opens in its surface.
  const cta = f.kind === "writing" ? "Read it" : f.takeUp === "rsvp" ? "Save a place" : f.takeUp === "pay" ? "Get a ticket" : "More details";

  return (
    <TemplateShell data={data} template="announcement">
      <div className="ost-announcement">
        {x.ribbon && (
          <div className="ost-announcement-ribbon">
            <span className="ost-announcement-pulse" aria-hidden />
            <span>{x.ribbon}</span>
          </div>
        )}
        <article className="ost-announcement-body">
          <span className="ost-announcement-kicker">Announcement</span>
          <h1 className="ost-announcement-title">{f.title}</h1>
          {text &&
            (looksLikeHtml(text) ? (
              <OstBody className="ost-announcement-text" data={data} html={text} />
            ) : (
              <p className="ost-announcement-text">{text}</p>
            ))}
          {facts.length > 0 && (
          <div className="ost-announcement-facts">
            {facts.map((k, i) => (
              <div key={i} className="ost-announcement-fact">
                <span className="ost-announcement-fact-label">{k.label}</span>
                <span className="ost-announcement-fact-value">{k.value}</span>
                {k.note && <span className="ost-announcement-fact-note">{k.note}</span>}
              </div>
            ))}
          </div>
          )}
          <div className="ost-announcement-actions">
            {ended ? (
              <span className="ost-announcement-ended">This event has ended.</span>
            ) : (
              <button type="button" className="ost-announcement-primary" onClick={(e) => openOffer(f, e.currentTarget, true)}>
                {cta}
              </button>
            )}
            {ics && (
              <a className="ost-announcement-quiet" href={ics} download={`${f.title}.ics`}>
                Add to calendar
              </a>
            )}
          </div>
          <span className="ost-announcement-posted">POSTED BY {data.owner.name.toUpperCase()}</span>
        </article>
      </div>
    </TemplateShell>
  );
}
