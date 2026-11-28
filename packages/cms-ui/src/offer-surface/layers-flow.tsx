"use client";

import * as React from "react";
import { useSurface } from "../surface/context";
import { useFinish, useFlowOrigin } from "./stack";
import type { SurfaceOffer, SurfaceProfile } from "./types";
import type { SurfaceIconKind } from "./icons";
import { OfferFrame, type HeadAction } from "./OfferFrame";
import { useOfferEnv } from "./env";
import { layerFor, offerDescriptor, offerSurfaceValue, type OfferFlow, type OfferProps } from "./descriptor";
import { fmtMoney, hasEnded, monoWhen, money, offerIcsUrl, shortWhen } from "./format";
import { useNowMs } from "./ended";
import { Avatar, Failure, Field, isEmail, Prose } from "./parts";
import { SurfaceIcon } from "./icons";
import type { TemplateData } from "./templates/types";
import { GUEST_RSVP, useJoinGate } from "./layers-join";

// The transaction layers (RSVP, pay, done, follow) and the people and share layers.

const FLOW_ICON: Record<OfferFlow, SurfaceIconKind> = { svc: "svc", evt: "evt", art: "art", ser: "ser", fol: "fol" };

/** The page the surface sits on, with `?surface=` replaced; browser only. */
export function pageUrlWith(value: string | null): string {
  const u = new URL(window.location.href);
  if (value) u.searchParams.set("surface", value);
  else u.searchParams.delete("surface");
  u.hash = "";
  return u.toString();
}

function offerPicture(o: SurfaceOffer | undefined): string | null {
  return o ? o.poster ?? o.images?.[0] ?? null : null;
}

// ── RSVP ────────────────────────────────────────────────────────────────────

export function EventRsvp({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const from = useFlowOrigin();
  const viewer = env.data.viewer;
  const offer = env.findOffer(props.key);
  const [name, setName] = React.useState(viewer?.name ?? "");
  const [email, setEmail] = React.useState(viewer?.email ?? "");
  const [remind, setRemind] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loginHref, setLoginHref] = React.useState<string | undefined>();
  const now = useNowMs();
  const signedIn = Boolean(viewer?.signedIn);

  const submit = async () => {
    if (!offer) return;
    setError(null);
    if (!signedIn && !gate) {
      if (!name.trim()) return setError("Add your name.");
      if (!isEmail(email)) return setError("Add an email address so the host can reach you.");
    }
    const r = await env.actions.rsvp(offer.key, { going: true, name: name.trim() || undefined, email: email.trim() || undefined, remind });
    if (r.ok === false) {
      setError(r.error);
      setLoginHref(r.loginHref);
      return;
    }
    push(offerDescriptor("done", offer.key, { flow: "evt", follows: r.follows ?? undefined, from }));
  };
  // Decision 14: signed out, the primary asks for an account (layer `join`); back here, signed in, the RSVP is recorded.
  const { gate, ask } = useJoinGate("rsvp", props.key, "evt", () => void submit());
  if (!offer) return <OfferFrame gk="evt" kicker="RSVP" title="Are you coming?"><p className="osf-note">This event is not available any more.</p></OfferFrame>;
  if (now != null && hasEnded(offer, now)) {
    return (
      <OfferFrame gk="evt" kicker="Event" title={offer.title} picture={offerPicture(offer)}>
        <p className="osf-note">This event has ended.</p>
      </OfferFrame>
    );
  }
  const cap = offer.capacity;

  return (
    <OfferFrame
      gk="evt"
      kicker="RSVP"
      title="Are you coming?"
      status={GUEST_RSVP && !signedIn ? "Free · no account needed" : "Free"}
      primary={{ label: "Yes, I'm coming", onClick: gate ? ask : submit }}
      picture={offerPicture(offer)}
    >
      {cap && (
        <p className="osf-note">
          {cap.coming} {cap.coming === 1 ? "person has" : "people have"} said they're coming{cap.limit != null ? ` · ${cap.limit} spaces` : ""}.
        </p>
      )}
      {!gate && (
        <div className="osf-two">
          <Field label="YOUR NAME" value={name} onChange={setName} autoComplete="name" />
          <Field label="EMAIL" value={email} onChange={setEmail} type="email" autoComplete="email" />
        </div>
      )}
      {gate && <p className="osf-note">You will make a quick account first, so the host knows who is coming.</p>}
      <label className="osf-check">
        <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
        <span className="osf-box" aria-hidden>✓</span>
        Email me a reminder beforehand
      </label>
      {!signedIn && !gate && env.signInHref && (
        <span className="osf-note">
          or <a href={env.signInHref}>sign in</a> to keep track of your RSVPs
        </span>
      )}
      <Failure error={error} loginHref={loginHref} />
    </OfferFrame>
  );
}

// ── pay ─────────────────────────────────────────────────────────────────────

export function Pay({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const viewer = env.data.viewer;
  const offer = env.findOffer(props.key);
  const ctx = props.ctx ?? {};
  const flow: OfferFlow = ctx.flow ?? "svc";
  const [email, setEmail] = React.useState(viewer?.email ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [loginHref, setLoginHref] = React.useState<string | undefined>();
  if (!offer || !offer.price) return <OfferFrame gk={FLOW_ICON[flow]} kicker="Pay" title="Confirm and pay"><p className="osf-note">There is nothing to pay for here.</p></OfferFrame>;

  const cur = offer.price.currency;
  let amount = flow === "svc" && ctx.amountMinor != null ? ctx.amountMinor : offer.price.amountMinor;
  let detail = "";
  if (flow === "svc") {
    const slot = offer.slots?.find((s) => s.id === ctx.slotId);
    detail = slot ? slot.label || shortWhen(slot.start, offer.when?.timeZone) : offer.durationMinutes ? `${offer.durationMinutes} min` : "";
  } else if (flow === "art") {
    if (ctx.delivery === "ship") {
      amount += offer.artwork?.shipping?.amountMinor ?? 0;
      detail = "Shipped";
    } else detail = "Collect from the studio";
  } else if (flow === "evt") {
    detail = offer.when?.start ? shortWhen(offer.when.start, offer.when.timeZone) : "One place";
  }
  const total = money(amount, cur);
  const signedIn = Boolean(viewer?.signedIn);

  const pay = async () => {
    setError(null);
    if (!signedIn && !isEmail(email)) return setError("Add an email address for your receipt.");
    const done = offerSurfaceValue("done", offer.key, flow);
    const r = await env.actions.checkout({
      key: offer.key,
      slotId: ctx.slotId,
      amountMinor: flow === "svc" ? ctx.amountMinor : undefined,
      delivery: ctx.delivery,
      address: ctx.address,
      email: signedIn ? undefined : email.trim(),
      returnTo: pageUrlWith(done),
    });
    if (r.ok === false) {
      setError(r.error);
      setLoginHref(r.loginHref);
      return;
    }
    // Stripe's own page takes the card. The button stays busy while the browser leaves.
    window.location.assign(r.url);
    await new Promise<void>(() => {});
  };

  return (
    <OfferFrame
      gk={FLOW_ICON[flow]}
      kicker="Pay"
      title="Confirm and pay"
      status="Secure · Stripe"
      primary={{ label: `Pay ${fmtMoney(total)}`, onClick: pay }}
      picture={offerPicture(offer)}
    >
      <div className="osf-summary">
        <div>
          <span className="osf-dim">For</span>
          <span>{offer.title}</span>
        </div>
        {detail && (
          <div>
            <span className="osf-dim">Detail</span>
            <span>{detail}</span>
          </div>
        )}
        <div className="is-total">
          <span>Total</span>
          <span>{fmtMoney(total)}</span>
        </div>
      </div>
      {signedIn ? (
        <div className="osf-payas">
          <Avatar size={24} />
          <span>Paying as {viewer?.name || viewer?.email || "you"}</span>
          {env.signInHref && <a className="osf-change" href={env.signInHref}>CHANGE</a>}
        </div>
      ) : (
        <>
          <Field label="EMAIL FOR YOUR RECEIPT" value={email} onChange={setEmail} type="email" autoComplete="email" />
          {env.signInHref && (
            <span className="osf-note">
              or <a href={env.signInHref}>sign in</a>
            </span>
          )}
        </>
      )}
      {/* The packet's card panel: Stripe's own page takes the real fields, so these are drawn, never typed into. */}
      <div className="osf-cardbox" aria-hidden>
        <span className="osf-mono-label">CARD · HANDLED BY STRIPE</span>
        <div className="osf-fakefield">1234 1234 1234 1234</div>
        <div className="osf-two">
          <div className="osf-fakefield">MM / YY</div>
          <div className="osf-fakefield">CVC</div>
        </div>
      </div>
      <p className="osf-note is-small">Card details go to Stripe, not this site. When it's done you come back to this popup.</p>
      <Failure error={error} loginHref={loginHref} />
    </OfferFrame>
  );
}

// ── done ────────────────────────────────────────────────────────────────────

export function Done({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const { finish } = useFinish(props.ctx?.from);
  const ctx = props.ctx ?? {};
  const flow: OfferFlow = ctx.flow ?? "svc";
  const offer = flow === "fol" ? undefined : env.findOffer(props.key);
  const who = flow === "fol" ? env.findProfile(props.key) : undefined;

  let title = "Done";
  let line = offer?.title ?? who?.name ?? "";
  let note = "";
  let ics: string | null = null;

  if (flow === "svc") {
    title = "You're booked";
    const slot = offer?.slots?.find((s) => s.id === ctx.slotId);
    if (offer) line = slot ? `${offer.title} · ${slot.label || shortWhen(slot.start, offer.when?.timeZone)}` : offer.title;
    note = "A receipt and the details are on their way by email.";
    if (offer && slot) ics = offerIcsUrl({ uid: `${offer.key}:${slot.id}`, title: offer.title, startIso: slot.start, minutes: offer.durationMinutes });
  } else if (flow === "evt") {
    title = "You're coming";
    if (offer?.when?.start) line = `${offer.title} · ${shortWhen(offer.when.start, offer.when.timeZone)}`;
    note = ctx.follows ? `You now follow ${ctx.follows}, so you get what they offer next.` : "The host has your RSVP.";
    if (offer?.when?.start) ics = offerIcsUrl({ uid: offer.key, title: offer.title, startIso: offer.when.start, minutes: offer.durationMinutes, location: offer.venue?.name });
  } else if (flow === "art") {
    title = "Order placed";
    note = "A receipt is on its way. Tracking follows when it ships.";
  } else if (flow === "ser") {
    title = "You're subscribed";
    note = "Each email lets you say you're coming to that session.";
  } else {
    title = "You're following";
    line = who ? `${who.name} · by email` : "";
    note = "New offers and writing arrive by email. Each one has an unfollow link.";
  }

  return (
    <OfferFrame
      gk="done"
      kicker="Done"
      title={title}
      primary={{ label: "Done", onClick: finish }}
      quiet={ics ? { label: "Add to calendar", href: ics, download: "event.ics" } : undefined}
      noThumb
    >
      <span className="osf-check-disc" aria-hidden>✓</span>
      {line && <span className="osf-doneline">{line}</span>}
      {note && <p className="osf-note">{note}</p>}
      {flow === "evt" && offer && (
        <button type="button" className="osf-talkrow" onClick={() => push(offerDescriptor("talk", offer.key))}>
          <span>Talk</span>
          <span className="osf-talkgo">→</span>
        </button>
      )}
    </OfferFrame>
  );
}

// ── follow ──────────────────────────────────────────────────────────────────

export function Follow({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const from = useFlowOrigin();
  const viewer = env.data.viewer;
  const who = env.findProfile(props.key);
  const [email, setEmail] = React.useState(viewer?.email ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [loginHref, setLoginHref] = React.useState<string | undefined>();
  const signedIn = Boolean(viewer?.signedIn);

  const go = async () => {
    if (!who) return;
    setError(null);
    if (!signedIn && !gate && !isEmail(email)) return setError("Add the email address to send to.");
    const r = await env.actions.follow(who.id, { follow: true, email: signedIn ? undefined : email.trim() || undefined });
    if (r.ok === false) {
      setError(r.error);
      setLoginHref(r.loginHref);
      return;
    }
    env.setFollowing(who.id, r.following);
    push(offerDescriptor("done", who.id, { flow: "fol", from }));
  };
  // Decision 15: following needs an account. Signed out, the primary asks for one; back here, the follow is made.
  const { gate, ask } = useJoinGate("follow", props.key, "fol", () => void go());
  if (!who) return <OfferFrame gk="fol" kicker="Follow" title="Follow" noThumb><p className="osf-note">This profile is not available.</p></OfferFrame>;

  return (
    <OfferFrame gk="fol" kicker="Follow" title={`Follow ${who.name}`} status="By email · unfollow any time" primary={{ label: "Follow", onClick: gate ? ask : go }} noThumb>
      <div className="osf-who">
        <Avatar src={who.portrait} size={42} ring />
        <div>
          <span className="osf-who-name">{who.name}</span>
          {who.role && <span className="osf-role">{who.role}</span>}
        </div>
      </div>
      <p className="osf-text">New offers and writing from {who.name}, by email. At most one a week.</p>
      {!signedIn && !gate && <Field label="EMAIL" value={email} onChange={setEmail} type="email" autoComplete="email" />}
      {!signedIn && !gate && env.signInHref && (
        <span className="osf-note">
          or <a href={env.signInHref}>sign in</a> to follow from your Center
        </span>
      )}
      <Failure error={error} loginHref={loginHref} />
    </OfferFrame>
  );
}

// ── share ───────────────────────────────────────────────────────────────────

export function Share({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const offer = env.findOffer(props.key);
  const [copied, setCopied] = React.useState(false);
  const [embedded, setEmbedded] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  if (!offer) return <OfferFrame gk="share" kicker="Share" title="Share this" noThumb><p className="osf-note">Nothing to share.</p></OfferFrame>;
  const layer = layerFor(offer) ?? "evt-offer";
  const url = pageUrlWith(offerSurfaceValue(layer, offer.key));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      input.current?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
  };
  const embed = async () => {
    try {
      await navigator.clipboard.writeText(`<iframe src="${url}" title="${offer.title.replace(/"/g, "&quot;")}" width="440" height="640" style="border:0"></iframe>`);
      setEmbedded(true);
    } catch {
      setEmbedded(false);
    }
  };

  return (
    <OfferFrame gk="share" kicker="Share" title="Share this" primary={{ label: copied ? "✓ Copied" : "Copy link", onClick: copy }} noThumb>
      <div className="osf-field">
        <span className="osf-mono-label">LINK</span>
        <input ref={input} className="osf-input osf-linkfield" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link" />
      </div>
      <div className="osf-three">
        <a className="osf-chip" href={`mailto:?subject=${encodeURIComponent(offer.title)}&body=${encodeURIComponent(url)}`}>Email</a>
        <a className="osf-chip" href={`sms:?&body=${encodeURIComponent(url)}`}>Message</a>
        <button type="button" className="osf-chip" onClick={embed}>
          {embedded ? "✓ Copied" : "Embed"}
        </button>
      </div>
      <p className="osf-note">The link opens this page with the same popup on top, so whoever gets it lands on the offer.</p>
    </OfferFrame>
  );
}

// ── people ──────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).toUpperCase()}`;
}

function offerMeta(o: SurfaceOffer, featured: boolean): string {
  const bits: string[] = [];
  if (featured) bits.push("ON NOW");
  if (o.kind === "event" && o.when?.start) bits.push(monoWhen(o.when.start, o.when.timeZone));
  else bits.push(o.kind.toUpperCase());
  if (o.kind !== "event" && o.price) bits.push(fmtMoney(o.price));
  if (o.kind === "service" && o.durationMinutes) bits.push(`${o.durationMinutes} MIN`);
  if (o.kind === "artwork" && o.artwork?.edition) bits.push(o.artwork.edition.toUpperCase());
  return bits.join(" · ");
}

const KIND_ICON: Record<string, SurfaceIconKind> = { event: "evt", service: "svc", series: "ser", artwork: "art", writing: "wr" };

export function ProfileLayer({ props, guest }: { props: OfferProps; guest?: boolean }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const [error, setError] = React.useState<string | null>(null);
  const who: SurfaceProfile | undefined = env.findProfile(props.key);
  if (!who) return <OfferFrame gk="pf" kicker="Profile" title="Profile" noThumb><p className="osf-note">This profile is not available.</p></OfferFrame>;
  const owner = who.id === env.data.owner.id;
  const following = env.isFollowing(who.id);
  const rows: Array<{ o: SurfaceOffer; featured: boolean }> = [];
  if (owner) {
    const f = env.data.featured;
    if (f) rows.push({ o: f, featured: true });
    for (const o of env.data.offers) if (o.key !== f?.key) rows.push({ o, featured: false });
  }

  const pieces = ((env.data as Partial<TemplateData>).pieces ?? []) as Array<{ key: string; date?: string | null }>;
  const hereRows = guest ? env.data.offers.filter((o) => o.hostId === who.id || o.coHostIds?.includes(who.id)) : [];
  const headAction: HeadAction | null = guest && who.siteHref ? { icon: "⤢", label: "Their site", href: who.siteHref } : null;
  const unfollow = async () => {
    setError(null);
    const r = await env.actions.follow(who.id, { follow: false });
    if (r.ok === false) return setError(r.error);
    env.setFollowing(who.id, false);
  };

  return (
    <OfferFrame
      gk="pf"
      kicker={guest ? "Co-host" : "Profile"}
      title={who.name}
      status={following ? "You're following" : who.followers != null ? `${who.followers} following` : undefined}
      primary={following ? { label: "✓ Following", onClick: unfollow } : { label: "Follow", onClick: () => push(offerDescriptor("follow", who.id, { flow: "fol" })) }}
      headAction={headAction}
      picture={who.portrait}
      portrait
    >
      {who.portrait ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="osf-portrait" src={who.portrait} alt="" />
      ) : (
        <span className="osf-portrait osf-ph osf-ph-cap" aria-hidden>
          portrait
        </span>
      )}
      {who.role && <span className="osf-role">{who.role}</span>}
      <Prose text={who.bio} />
      {who.links && who.links.length > 0 && (
        <div className="osf-links">
          {who.links.map((l) => (
            <a key={l.href} className="osf-chip" href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <span className="osf-label is-ruled">Offered here</span>
          <div className="osf-rows">
            {rows.map(({ o, featured }) => {
              const layer = layerFor(o);
              const inner = (
                <>
                  <span className="osf-kbox" style={{ ["--osf-kc" as string]: `var(--os-kind-${o.kind === "writing" ? "writing" : o.kind === "event" ? "event" : o.kind === "service" ? "service" : o.kind === "series" ? "series" : "artwork"})` }}>
                    <KindIcon kind={KIND_ICON[o.kind] ?? "evt"} />
                  </span>
                  <span className="osf-rowtext">
                    <span className="osf-rowtitle">{o.title}</span>
                    <span className={`osf-mono-meta${featured ? " is-on" : ""}`} suppressHydrationWarning>
                      {offerMeta(o, featured)}
                    </span>
                  </span>
                  <span className="osf-chev" aria-hidden>
                    ›
                  </span>
                </>
              );
              return layer ? (
                <button key={o.key} type="button" className="osf-row" onClick={() => push(offerDescriptor(layer, o.key, featured ? { featured: true } : undefined))}>
                  {inner}
                </button>
              ) : o.href ? (
                <a key={o.key} className="osf-row" href={o.href}>
                  {inner}
                </a>
              ) : null;
            })}
          </div>
        </>
      )}
      {owner && env.data.writing.length > 0 && (
        <>
          <span className="osf-label">Writing</span>
          <div className="osf-rows">
            {env.data.writing.map((w) => {
              const date = pieces.find((x) => x.key === w.key)?.date;
              const meta = [date ? shortDate(date) : null, w.minutes ? `${w.minutes} MIN` : null].filter(Boolean).join(" · ");
              return (
                <button key={w.key} type="button" className="osf-row is-writing" onClick={() => push(offerDescriptor("wr-read", w.key))}>
                  <span className="osf-wtitle">{w.title}</span>
                  {meta ? <span className="osf-mono-meta">{meta}</span> : null}
                </button>
              );
            })}
          </div>
        </>
      )}
      {guest && hereRows.length > 0 && (
        <>
          <span className="osf-label is-ruled">Here</span>
          {hereRows.map((o) => {
            const layer = layerFor(o);
            return (
              <button key={o.key} type="button" className="osf-herecard" disabled={!layer} onClick={() => layer && push(offerDescriptor(layer, o.key))}>
                <span className="osf-kbox" style={{ ["--osf-kc" as string]: "var(--os-bronze)" }}>
                  <KindIcon kind={KIND_ICON[o.kind] ?? "ser"} />
                </span>
                <span className="osf-rowtext">
                  <span className="osf-rowtitle">{o.title}</span>
                  <span className="osf-mono-meta">{["CO-HOSTS", offerMeta(o, false).replace(/^[A-Z]+ · /, "")].join(" · ")}</span>
                </span>
                <span className="osf-herego" aria-hidden>→</span>
              </button>
            );
          })}
        </>
      )}
      {guest && who.siteHref && (
        <>
          <span className="osf-label">On their site</span>
          <a className="osf-ext" href={who.siteHref}>
            <span className="osf-rowtitle">{who.siteHref.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
            <span aria-hidden>↗</span>
          </a>
          <p className="osf-note is-small">Their own offers open on their own site. Following them here is the same as following them there.</p>
        </>
      )}
      <Failure error={error} />
    </OfferFrame>
  );
}

function KindIcon({ kind }: { kind: SurfaceIconKind }) {
  const env = useOfferEnv();
  return <SurfaceIcon kind={kind} set={env.data.look.icons} size={14} />;
}
