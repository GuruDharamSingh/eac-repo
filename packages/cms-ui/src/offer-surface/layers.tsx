"use client";

import * as React from "react";
import { useSurface } from "../surface/context";
import type { Money, SurfaceOffer } from "./types";
import { OfferFrame, type HeadAction } from "./OfferFrame";
import { useOfferEnv, type OfferEnv } from "./env";
import { offerDescriptor, type OfferCtx, type OfferLayerId, type OfferProps } from "./descriptor";
import { dateBlock, fmtMoney, hasEnded, money, shortDate, shortWhen } from "./format";
import { useNowMs } from "./ended";
import { Avatar, Label, Prose, Radio } from "./parts";
import type { TemplateData } from "./templates/types";

// The offer layers: what is offered, before any transaction.

/** Share while the offer is just being read; the featured offer opened from the profile links to its own page. */
export function offerHeadAction(offer: SurfaceOffer, ctx: OfferCtx | undefined, share: () => void): HeadAction | null {
  // No "Its page": nothing on the page navigates away (Justin, 2026-11-27).
  void offer;
  void ctx;
  return { icon: "↗", label: "Share", onClick: share };
}

export function hostLayer(env: OfferEnv, hostId: string): OfferLayerId | null {
  if (!env.findProfile(hostId)) return null;
  return hostId === env.data.owner.id ? "pf-owner" : "pf-guest";
}

function Missing({ title }: { title: string }) {
  return (
    <OfferFrame gk="evt" kicker="Offer" title={title}>
      <p className="osf-note">This offer is not available any more.</p>
    </OfferFrame>
  );
}

function offerPicture(o: SurfaceOffer): string | null {
  return o.poster ?? o.images?.[0] ?? null;
}

function HostRow({ offer }: { offer: SurfaceOffer }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const host = env.findProfile(offer.hostId);
  const layer = hostLayer(env, offer.hostId);
  if (!host || !layer) return null;
  // "Usually replies within a day" is a template extra of the owner's offers.
  const reply = host.id === env.data.owner.id ? (env.data as Partial<TemplateData>).extras?.replyNote : undefined;
  return (
    <button type="button" className="osf-host" onClick={() => push(offerDescriptor(layer, host.id))}>
      <Avatar src={host.portrait} size={26} />
      <span className="osf-host-text">
        <span className="osf-host-name">{host.name}</span>
        {reply && <span className="osf-host-reply">● {reply.toUpperCase()}</span>}
      </span>
      <span className="osf-chev" aria-hidden>
        ›
      </span>
    </button>
  );
}

// ── event ───────────────────────────────────────────────────────────────────

export function EventOffer({ offerKey, ctx }: { offerKey?: string; ctx?: OfferCtx }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const now = useNowMs();
  const offer = env.findOffer(offerKey);
  if (!offer) return <Missing title="Event" />;
  // Live until mounted, then ended when the event is over (hydration-safe, as the countdown is).
  const ended = now != null && hasEnded(offer, now);
  const share = () => push(offerDescriptor("share", offer.key));
  const when = offer.when;
  const b = when?.start ? dateBlock(when.start, when.timeZone) : null;
  const cap = offer.capacity;
  const full = Boolean(cap && cap.limit != null && cap.coming >= cap.limit);
  const priced = offer.takeUp === "pay" && offer.price;
  const host = hostLayer(env, offer.hostId);
  // Running order and who is coming are template extras: absent on a live site until the data exists.
  const extras = (env.data as Partial<TemplateData>).extras;
  const program = extras?.program ?? [];
  const attendees = extras?.attendees ?? [];

  let primary;
  if (ended) {
    primary = undefined;
  } else if (priced) {
    primary = { label: `Get a place · ${fmtMoney(offer.price)}`, onClick: () => push(offerDescriptor("pay", offer.key, { ...ctx, flow: "evt" })) };
  } else if (offer.takeUp === "rsvp") {
    primary = { label: full ? "Full" : "I'm coming", disabled: full, onClick: () => push(offerDescriptor("evt-rsvp", offer.key, ctx)) };
  } else if (host) {
    primary = { label: "Ask the host", onClick: () => push(offerDescriptor(host, offer.hostId)) };
  }
  let status = cap ? `${cap.coming} coming${cap.limit != null ? ` · ${cap.limit} spaces` : ""}` : undefined;
  let quiet;
  if (ended) {
    status = when?.start ? `Ended · ${shortDate(when.start, when.timeZone)}` : "Ended";
    quiet = { label: "Open the talk", onClick: () => push(offerDescriptor("talk", offer.key)) };
  }

  return (
    <OfferFrame gk="evt" kicker="Event" title={offer.title} status={status} primary={primary} quiet={quiet} headAction={offerHeadAction(offer, ctx, share)} picture={offerPicture(offer)}>
      {offer.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="osf-poster" src={offer.poster} alt="" />
      ) : (
        <span className="osf-poster osf-ph osf-ph-cap" aria-hidden>
          event poster
        </span>
      )}
      {(b || offer.venue?.name) && (
        <div className="osf-dateblock">
          {b && (
            <>
              <span className="osf-bigday" suppressHydrationWarning>{b.day}</span>
              <span className="osf-mono-meta" suppressHydrationWarning>
                {b.weekday} · {b.month}
                <br />
                {b.time}
              </span>
            </>
          )}
          {(offer.venue?.name || offer.venue?.address || offer.venue?.online) && (
            <div className="osf-venue">
              <span className="osf-venue-name">{offer.venue?.name || (offer.venue?.online ? "Online" : "")}</span>
              {offer.venue?.address && <span className="osf-mono-meta">{offer.venue.address}</span>}
            </div>
          )}
        </div>
      )}
      {/* 4e / 3d draw no standfirst line on the event: the description follows the date block. */}
      <Prose text={offer.description} />
      {program.length > 0 && (
        <div className="osf-prog">
          {program.map((p, i) => (
            <div key={i} className="osf-prog-row">
              <span className="osf-prog-time">{p.time}</span>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      )}
      {cap && (
        <div className="osf-coming osf-stack">
          {attendees.slice(0, 3).map((a, i) => (
            <Avatar key={i} src={a.avatar} size={24} />
          ))}
          <span className="osf-stack-n">{cap.coming} coming</span>
        </div>
      )}
    </OfferFrame>
  );
}

// ── service ─────────────────────────────────────────────────────────────────

function slotLabel(s: { start: string; label?: string }, tz?: string | null): string {
  return s.label || shortWhen(s.start, tz);
}

export function ServiceOffer({ offerKey, ctx }: { offerKey?: string; ctx?: OfferCtx }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const offer = env.findOffer(offerKey);
  const slots = React.useMemo(() => (offer?.slots ?? []).slice(0, 3), [offer]);
  const sliding = offer?.sliding ?? null;
  const currency = offer?.price?.currency ?? "USD";
  const [slotId, setSlotId] = React.useState<string | undefined>(ctx?.slotId ?? slots[0]?.id);
  const [amount, setAmount] = React.useState<number>(() => {
    if (ctx?.amountMinor != null) return ctx.amountMinor;
    if (sliding) return Math.min(sliding.maxMinor, Math.max(sliding.minMinor, offer?.price?.amountMinor ?? sliding.maxMinor));
    return offer?.price?.amountMinor ?? 0;
  });
  if (!offer) return <Missing title="Service" />;
  const share = () => push(offerDescriptor("share", offer.key));
  const tz = offer.when?.timeZone;
  const host = hostLayer(env, offer.hostId);
  const total: Money | null = sliding ? money(amount, currency) : offer.price ?? null;
  const priced = Boolean(total && total.amountMinor > 0) && offer.takeUp === "pay";
  const needSlot = slots.length > 0 && !slotId;

  let primary;
  if (priced && total) {
    primary = {
      label: `Book · ${fmtMoney(total)}`,
      disabled: needSlot,
      onClick: () => push(offerDescriptor("pay", offer.key, { ...ctx, flow: "svc", slotId, amountMinor: sliding ? amount : undefined })),
    };
  } else if (host) {
    primary = { label: "Ask the host", onClick: () => push(offerDescriptor(host, offer.hostId)) };
  }

  const tags: Array<{ text: string; dashed?: boolean }> = [];
  if (offer.durationMinutes) tags.push({ text: `${offer.durationMinutes} MIN` });
  if (offer.venue?.online) tags.push({ text: "ONLINE" });
  if (sliding) tags.push({ text: `SLIDING ${fmtMoney(money(sliding.minMinor, currency))}–${fmtMoney(money(sliding.maxMinor, currency))}`, dashed: true });
  for (const t of offer.tags ?? []) {
    // The duration and "online" tags may already be drawn from their own fields.
    if (!tags.some((x) => x.text === t.toUpperCase())) tags.push({ text: t.toUpperCase() });
  }

  return (
    <OfferFrame
      gk="svc"
      kicker="Service"
      title={offer.title}
      status={slots.length ? `${slots.length} ${slots.length === 1 ? "time" : "times"} open` : undefined}
      primary={primary}
      headAction={offerHeadAction(offer, ctx, share)}
      picture={offerPicture(offer)}
    >
      {offer.standfirst && <div className="osf-standfirst">{offer.standfirst}</div>}
      {tags.length > 0 && (
        <div className="osf-tags">
          {tags.map((t) => (
            <span key={t.text} className={`osf-tag${t.dashed ? " is-dashed" : ""}`}>
              {t.text}
            </span>
          ))}
        </div>
      )}
      <Prose text={offer.description} />
      {slots.length > 0 && (
        <div role="radiogroup" aria-label="Pick a time" className="osf-group">
          <Label>Pick a time</Label>
          {slots.map((s) => (
            <Radio key={s.id} selected={slotId === s.id} onPick={() => setSlotId(s.id)}>
              <span suppressHydrationWarning>{slotLabel(s, tz)}</span>
            </Radio>
          ))}
        </div>
      )}
      {sliding && (
        <>
          <div className="osf-payrow">
            <span className="osf-mono-label">PAY WHAT YOU CAN</span>
            <span className="osf-payamt">{fmtMoney(money(amount, currency))}</span>
          </div>
          <input
            type="range"
            className="osf-range"
            aria-label="Amount"
            min={sliding.minMinor}
            max={sliding.maxMinor}
            step={sliding.stepMinor ?? 500}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </>
      )}
      <HostRow offer={offer} />
    </OfferFrame>
  );
}

// ── artwork ─────────────────────────────────────────────────────────────────

export function ArtworkOffer({ offerKey, ctx }: { offerKey?: string; ctx?: OfferCtx }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const offer = env.findOffer(offerKey);
  const [shown, setShown] = React.useState(0);
  if (!offer) return <Missing title="Artwork" />;
  const share = () => push(offerDescriptor("share", offer.key));
  const pics = offer.images?.length ? offer.images : offer.poster ? [offer.poster] : [];
  const art = offer.artwork;
  const rows: Array<[string, string | null | undefined]> = [
    ["MEDIUM", art?.medium],
    ["SIZE", art?.size],
    ["EDITION", art?.edition],
  ];
  const orderable = offer.takeUp === "order" && offer.price;
  const host = hostLayer(env, offer.hostId);

  let primary;
  if (orderable) primary = { label: `Order · ${fmtMoney(offer.price)}`, onClick: () => push(offerDescriptor("art-order", offer.key, { ...ctx, flow: "art" })) };
  else if (host) primary = { label: "Ask about this work", onClick: () => push(offerDescriptor(host, offer.hostId)) };

  return (
    <OfferFrame gk="art" kicker="Artwork" title={offer.title} status={art?.edition ?? undefined} primary={primary} headAction={offerHeadAction(offer, ctx, share)} picture={pics[0] ?? null}>
      {pics.length > 0 && (pics[Math.min(shown, pics.length - 1)] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="osf-work" src={pics[Math.min(shown, pics.length - 1)]} alt={offer.title} />
      ) : (
        <span className="osf-work osf-ph osf-ph-cap" aria-hidden>
          the work
        </span>
      ))}
      {pics.length > 1 && (
        <div className="osf-thumbs">
          {pics.slice(0, 3).map((src, i) => (
            <button key={i} type="button" className={`osf-thumb${i === shown ? " is-on" : ""}${src ? "" : " osf-ph"}`} aria-label={`Picture ${i + 1}`} aria-pressed={i === shown} onClick={() => setShown(i)}>
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" />
              ) : null}
            </button>
          ))}
        </div>
      )}
      {rows.some(([, v]) => v) && (
        <div className="osf-spec">
          {rows.map(([k, v]) =>
            v ? (
              <div key={k} className="osf-spec-row">
                <span className="osf-mono-meta">{k}</span>
                <span>{v}</span>
              </div>
            ) : null
          )}
        </div>
      )}
      <Prose text={offer.description} />
    </OfferFrame>
  );
}

// ── artwork order: delivery ─────────────────────────────────────────────────

export function ArtworkOrder({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const offer = env.findOffer(props.key);
  const art = offer?.artwork;
  const shipAvail = Boolean(art?.shipping) || !art?.collect;
  const collectAvail = Boolean(art?.collect);
  const [delivery, setDelivery] = React.useState<"ship" | "collect">(props.ctx?.delivery ?? (shipAvail ? "ship" : "collect"));
  const [address, setAddress] = React.useState(props.ctx?.address ?? "");
  if (!offer || !offer.price) return <Missing title="Delivery" />;
  const cur = offer.price.currency;
  const shipCost = delivery === "ship" ? art?.shipping ?? money(0, cur) : money(0, cur);
  const total = money(offer.price.amountMinor + shipCost.amountMinor, cur);
  const needAddress = delivery === "ship" && address.trim().length < 6;

  return (
    <OfferFrame
      gk="art"
      kicker="Order"
      title="Delivery"
      status={`Total ${fmtMoney(total)}`}
      primary={{
        label: "Continue to pay",
        disabled: needAddress,
        onClick: () => push(offerDescriptor("pay", offer.key, { ...props.ctx, flow: "art", delivery, address: delivery === "ship" ? address.trim() : undefined })),
      }}
      picture={offerPicture(offer)}
    >
      <div role="radiogroup" aria-label="How it reaches you" className="osf-group">
        <Label>How it reaches you</Label>
        {shipAvail && (
          <Radio selected={delivery === "ship"} onPick={() => setDelivery("ship")} aside={art?.shipping ? fmtMoney(art.shipping) : undefined}>
            Ship to me
          </Radio>
        )}
        {collectAvail && (
          <Radio selected={delivery === "collect"} onPick={() => setDelivery("collect")} aside="FREE">
            Collect from the studio
          </Radio>
        )}
      </div>
      {delivery === "ship" && (
        <label className="osf-field">
          <span className="osf-mono-label">ADDRESS</span>
          <input className="osf-input" type="text" value={address} autoComplete="street-address" onChange={(e) => setAddress(e.target.value)} />
        </label>
      )}
      <div className="osf-totals">
        <div>
          <span className="osf-dim">Work</span>
          <span>{fmtMoney(offer.price)}</span>
        </div>
        <div>
          <span className="osf-dim">Delivery</span>
          <span>{shipCost.amountMinor ? fmtMoney(shipCost) : delivery === "collect" ? "Free" : "Included"}</span>
        </div>
        <div className="is-total">
          <span>Total</span>
          <span>{fmtMoney(total)}</span>
        </div>
      </div>
    </OfferFrame>
  );
}
