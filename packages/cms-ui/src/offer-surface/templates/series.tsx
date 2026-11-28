"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { offerDescriptor } from "../descriptor";
import { dateBlock } from "../format";
import { PersonName } from "../layers-people";
import { Prose } from "../parts";
import { TemplateShell } from "./shell";
import type { TemplateProps } from "./types";

// Series (derived from the packet's ser-offer / ser-session surfaces, drawn in
// the language of 2m and 2n). Subscribe is drawn and inert: the ser-* layers
// are not built yet.

export function SeriesTemplate({ data }: TemplateProps) {
  const { open } = useSurface();
  const [all, setAll] = React.useState(false);
  const o = data.featured;
  if (!o) return null;
  const hostIds = [o.hostId, ...(o.coHostIds ?? [])].filter((id, i, a) => id && a.indexOf(id) === i);
  const sessions = data.extras.sessions ?? [];
  // Every session over: the newest is the latest, not the next.
  const allPast = sessions.length > 0 && sessions.every((s) => s.past);
  const next = (allPast ? undefined : sessions.find((s) => s.next)) ?? sessions[0];
  const earlier = sessions.filter((s) => s !== next);
  const b = o.when?.start ? dateBlock(o.when.start, o.when.timeZone) : null;
  const tzShort = o.when?.timeZone ? (o.when.timeZone.includes("Los_Angeles") ? "PT" : o.when.timeZone.split("/").pop()) : "";
  const strip: Array<[string, string]> = [];
  if (b) {
    const day = b.weekday.charAt(0) + b.weekday.slice(1).toLowerCase();
    strip.push(["WHEN", `${day === "Mon" ? "Mondays" : `${day}s`}`]);
    strip.push(["TIME", `${b.time.replace(":00", "").toLowerCase()}${tzShort ? ` ${tzShort}` : ""}`]);
  }
  strip.push(["WHERE", o.venue?.online ? "Online" : (o.venue?.name ?? "")]);

  return (
    <TemplateShell data={data} template="series">
      <div className="ost-series">
        <section className="ost-series-main" aria-label="The series">
          <span className="ost-series-kicker">Series{o.takeUp === "subscribe" ? " · Weekly" : ""}</span>
          <h1 className="ost-series-title">{o.title}</h1>
          {o.standfirst && <p className="ost-series-stand">{o.standfirst}</p>}
          <Prose className="ost-body ost-series-para" text={o.description} />
          <dl className="ost-series-strip">
            {strip.map(([k, v]) => (
              <div key={k} className="ost-series-cell">
                <dt>{k}</dt>
                <dd suppressHydrationWarning>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="ost-series-hosts">
            <span className="ost-series-hk">HOSTED BY</span>
            {hostIds.map((id, i) => (
              <React.Fragment key={id}>
                {i > 0 && <span className="ost-series-and">{i === hostIds.length - 1 ? " and " : ", "}</span>}
                <PersonName id={id} className="ost-series-name" />
              </React.Fragment>
            ))}
          </p>
        </section>

        <aside className="ost-series-rail" aria-label="Sessions">
          {next && (
            <button type="button" className="ost-series-next" onClick={(e) => open(offerDescriptor("ser-session", o.key, { flow: "ser", slotId: String(next.n) }), e.currentTarget)}>
              <span className="ost-series-pk">{allPast ? "LATEST SESSION" : "NEXT SESSION"} · {next.n}</span>
              <span className="ost-series-nt">{next.title}</span>
              <span className="ost-series-nw" suppressHydrationWarning>
                {next.when}
              </span>
              <span className="ost-series-nlink" aria-hidden>
                Session details →
              </span>
            </button>
          )}
          <button type="button" className="ost-series-go" onClick={(e) => open(offerDescriptor("ser-sub", o.key, { flow: "ser" }), e.currentTarget)}>
            Subscribe
          </button>
          <span className="ost-series-fine">One email before each session.</span>
          {earlier.length > 0 && (
            <div className="ost-series-earlier">
              <button type="button" className="ost-series-toggle" aria-expanded={all} onClick={() => setAll((v) => !v)}>
                {all ? "▾" : "▸"} EARLIER SESSIONS ({earlier.length})
              </button>
              {all && (
                <ul className="ost-series-list">
                  {earlier.map((s) => (
                    <li key={s.n}>
                      <button type="button" className="ost-series-erow" onClick={(e) => open(offerDescriptor("ser-session", o.key, { flow: "ser", slotId: String(s.n) }), e.currentTarget)}>
                        <span className="ost-series-en">{s.n}</span>
                        <span className="ost-series-et">{s.title}</span>
                        <span className="ost-series-ew">{s.when}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </TemplateShell>
  );
}
