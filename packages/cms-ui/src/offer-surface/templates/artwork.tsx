"use client";

import * as React from "react";
import { useSurface } from "../../surface/context";
import { offerDescriptor } from "../descriptor";
import { fmtMoney } from "../format";
import { PersonName } from "../layers-people";
import { useOpenOffer } from "../page";
import { Prose } from "../parts";
import { TemplateShell } from "./shell";
import type { TemplateProps } from "./types";

// Work (derived from the packet's art-offer surface, drawn in the language of
// 2m and 2n): the work large on the left, its facts and the order in a rail.

export function ArtworkTemplate({ data }: TemplateProps) {
  const { open } = useSurface();
  const openOffer = useOpenOffer();
  const o = data.featured;
  const [shown, setShown] = React.useState(0);
  if (!o) return null;
  const host = data.owner;
  const art = o.artwork;
  const real = o.images?.length ? o.images.slice(0, 3) : o.poster ? [o.poster] : [];
  const pics = real.length || !data.placeholders ? real : [""];
  const rows: Array<[string, string | null | undefined]> = [
    ["MEDIUM", art?.medium],
    ["SIZE", art?.size],
    ["EDITION", art?.edition],
  ];
  const orderable = o.takeUp === "order" && o.price;
  const Pic = ({ src, cls }: { src: string; cls: string }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={cls} src={src} alt={cls.includes("main") ? o.title : ""} />
    ) : (
      <span className={`${cls} osf-ph`} aria-hidden />
    );

  return (
    <TemplateShell data={data} template="artwork">
      <div className={`ost-artwork${pics.length ? "" : " is-bare"}`}>
        {pics.length > 0 && (
        <section className="ost-artwork-stage" aria-label="The work">
          <div className="ost-artwork-big">
            <Pic src={pics[Math.min(shown, pics.length - 1)] ?? ""} cls="ost-artwork-main" />
            <span className="ost-artwork-cap">work · {shown + 1} of {pics.length}</span>
          </div>
          {pics.length > 1 && (
            <div className="ost-artwork-thumbs">
              {pics.map((src, i) => (
                <button key={i} type="button" className={`ost-artwork-thumb${i === shown ? " is-on" : ""}`} aria-label={`Picture ${i + 1}`} aria-pressed={i === shown} onClick={() => setShown(i)}>
                  <Pic src={src} cls="ost-artwork-timg" />
                </button>
              ))}
            </div>
          )}
        </section>
        )}

        <aside className="ost-artwork-rail" aria-label="About the work">
          <span className="ost-artwork-kicker">Artwork{art?.edition ? ` · ${art.edition}` : ""}</span>
          <h1 className="ost-artwork-title">{o.title}</h1>
          <p className="ost-artwork-by">
            by <PersonName id={host.id} className="ost-artwork-by-name" />
          </p>
          {o.standfirst && <p className="ost-artwork-stand">{o.standfirst}</p>}
          <div className="ost-artwork-spec">
            {rows.map(([k, v]) =>
              v ? (
                <div key={k} className="ost-artwork-row">
                  <span className="ost-artwork-rk">{k}</span>
                  <span>{v}</span>
                </div>
              ) : null
            )}
          </div>
          {o.price && (
            <div className="ost-artwork-price">
              <span className="ost-artwork-pk">PRICE</span>
              <span className="ost-artwork-amt">{fmtMoney(o.price)}</span>
            </div>
          )}
          {orderable ? (
            <button type="button" className="ost-artwork-go" onClick={(e) => openOffer(o, e.currentTarget)}>
              Order · {fmtMoney(o.price)}
            </button>
          ) : (
            <button type="button" className="ost-artwork-go" onClick={(e) => open(offerDescriptor("pf-owner", host.id), e.currentTarget)}>
              Ask about this work
            </button>
          )}
          {art?.shipping || art?.collect ? (
            <span className="ost-artwork-fine">
              {art?.shipping ? `Ships for ${fmtMoney(art.shipping)}` : ""}
              {art?.shipping && art?.collect ? " · " : ""}
              {art?.collect ? "or collect from the studio" : ""}
            </span>
          ) : null}
          {o.description && (
            <div className="ost-artwork-note">
              <span className="ost-artwork-pk">ARTIST&apos;S NOTE</span>
              <Prose className="ost-body" text={o.description} />
            </div>
          )}
          <div className="ost-artwork-host">
            <span className="ost-artwork-av" aria-hidden />
            <div className="ost-artwork-who">
              <span className="ost-artwork-name">
                <PersonName id={host.id} />
              </span>
              {data.extras.replyNote && <span className="ost-artwork-reply">● {data.extras.replyNote}</span>}
            </div>
            <button type="button" className="ost-artwork-btn" onClick={(e) => open(offerDescriptor("pf-owner", host.id), e.currentTarget)}>
              Profile →
            </button>
          </div>
        </aside>
      </div>
    </TemplateShell>
  );
}
