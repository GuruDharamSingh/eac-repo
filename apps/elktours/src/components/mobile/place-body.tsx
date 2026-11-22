"use client";

import Link from "next/link";
import { ArchFrame } from "./arch-frame";
import { hostOf, openWebView } from "./web-view";
import type { PlaceSheetData } from "@/blocks/mobile/types";
import "./overlays.css";

/** The place body shared by the phone place sheet (?place=) and the public `place-detail` surface popup. */
export function PlaceBody({ p, pathname, showHead = true }: { p: PlaceSheetData; pathname?: string; showHead?: boolean }) {
  const tour = p.tours[0];
  return (
    <>
      {showHead ? (
        <div className="m-ov-head">
          <ArchFrame w={92} h={112} bottom={14} brass src={p.img} />
          <div className="m-ov-headtext">
            <span className="m-kicker">{p.kind}</span>
            <h2 className="m-ov-name">{p.name}</h2>
          </div>
        </div>
      ) : null}
      {p.blurb ? <p className="m-ov-blurb">{p.blurb}</p> : null}
      {p.tags.length > 0 ? (
        <div className="m-ov-tags">
          {p.tags.map((t) => (
            <span key={t} className="m-ov-tag">{t}</span>
          ))}
        </div>
      ) : null}
      {p.favouriteBy.length > 0 ? <p className="m-ov-fav">A favourite of {p.favouriteBy.join(" and ")}</p> : null}
      {(p.address || p.hours) && (
        <dl className="m-ov-facts">
          {p.address ? (
            <div><dt>Address</dt><dd>{p.address}</dd></div>
          ) : null}
          {p.hours ? (
            <div><dt>Hours</dt><dd style={{ whiteSpace: "pre-line" }}>{tidyHours(p.hours)}</dd></div>
          ) : null}
        </dl>
      )}
      {tour ? (
        <Link href={`/tours/${tour.slug}?stop=${p.id}`} className="m-ov-tour">
          <span>On a tour{tour.stop ? ` · Stop ${romanN(tour.stop)}` : ""} · {tour.title}</span>
          <span aria-hidden="true">›</span>
        </Link>
      ) : null}
      <div className="m-ov-actions">
        {p.website ? (
          <button type="button" className="m-ov-ghost" onClick={() => openWebView(p.website!)}>
            {hostOf(p.website)} ↗
          </button>
        ) : null}
        {p.mapsUrl ? (
          <a className="m-ov-ghost" href={p.mapsUrl} target="_blank" rel="noopener noreferrer">Directions ↗</a>
        ) : null}
      </div>
      {p.hasBusiness ? (
        <p className="m-ov-dashed">Business profile coming soon. Opening hours, offers and a booking link will live here.</p>
      ) : null}
      {pathname && pathname !== "/places" ? (
        <Link href="/places" className="m-ov-all">See all places →</Link>
      ) : null}
    </>
  );
}

const DAY: Record<string, string> = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
/** OSM opening_hours, lightly tidied: one rule per line, short day names spelled out. */
export function tidyHours(h: string): string {
  return h.split(";").map((x) => x.trim()).filter(Boolean).join("\n").replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => DAY[d] ?? d);
}

const ROMAN: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function romanN(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out || String(n);
}
