"use client";

import * as React from "react";
import { useSurface } from "../surface/context";
import { useFlowOrigin } from "./stack";
import { OfferFrame } from "./OfferFrame";
import { useOfferEnv } from "./env";
import { offerDescriptor, type OfferProps } from "./descriptor";
import { dateBlock, shortWhen, startEnded } from "./format";
import { useNowMs } from "./ended";
import { Avatar, Failure, Field, isEmail, Prose } from "./parts";
import { PersonName } from "./layers-people";
import { useJoinGate } from "./layers-join";
import type { SurfaceOffer, SurfaceProfile } from "./types";

// Series layers (lane B): ser-offer, ser-sub, ser-session. README "Layers";
// flows 3f / 4g. Styles live in layers-series.css (class prefix osf-ser-).
//
// The offer model has no session list yet. Until it does, a series is read as
// weekly from `when.start` (the next session), numbered 7 as in the packet,
// with earlier sessions a week apart. `sessions` on the offer wins when a host
// supplies it. The session a ser-session layer shows travels as ctx.slotId.

export interface SeriesSessionInfo {
  n: number;
  title: string;
  /** ISO start. */
  start: string;
  description?: string | null;
  file?: { name: string; size: string } | null;
}

type SeriesOfferData = SurfaceOffer & { sessions?: SeriesSessionInfo[]; hosts?: string[] };

const NEXT_N = 7;
const WEEK = 7 * 24 * 3600 * 1000;

export function seriesSessions(o: SurfaceOffer): { next: SeriesSessionInfo | null; earlier: SeriesSessionInfo[] } {
  const given = (o as SeriesOfferData).sessions;
  if (given?.length) {
    const sorted = [...given].sort((a, b) => b.n - a.n);
    return { next: sorted[0] ?? null, earlier: sorted.slice(1) };
  }
  const start = o.when?.start;
  if (!start) return { next: null, earlier: [] };
  const t = new Date(start).getTime();
  if (Number.isNaN(t)) return { next: null, earlier: [] };
  const mk = (n: number): SeriesSessionInfo => ({
    n,
    title: n === NEXT_N ? "Session title" : `Session ${n}`,
    start: new Date(t - (NEXT_N - n) * WEEK).toISOString(),
    description: "What this session will cover, written by its host.",
    file: n === NEXT_N ? { name: "Notes for this session.pdf", size: "240 KB" } : null,
  });
  return { next: mk(NEXT_N), earlier: [6, 5, 4, 3, 2, 1].map(mk) };
}

function hostsOf(env: ReturnType<typeof useOfferEnv>, o: SurfaceOffer): SurfaceProfile[] {
  const list: SurfaceProfile[] = [];
  for (const id of [o.hostId, ...(o.coHostIds ?? [])]) {
    const p = env.findProfile(id);
    if (p && !list.some((x) => x.id === p.id)) list.push(p);
  }
  return list;
}

function weekdayPlural(iso: string, tz?: string | null): string {
  const b = dateBlock(iso, tz);
  const names: Record<string, string> = { MON: "Mondays", TUE: "Tuesdays", WED: "Wednesdays", THU: "Thursdays", FRI: "Fridays", SAT: "Saturdays", SUN: "Sundays" };
  return names[b.weekday] ?? b.weekday;
}

function tzShort(tz?: string | null): string {
  if (!tz) return "";
  if (tz.includes("Los_Angeles")) return "PT";
  if (tz.includes("New_York") || tz.includes("Toronto")) return "ET";
  return "";
}

/** " · 9 ET" beside a Pacific time, as the packet draws it. */
function tzPair(iso: string, tz?: string | null): string {
  if (!tz || !tz.includes("Los_Angeles")) return "";
  const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "America/New_York" }).format(new Date(iso)).replace(/ ?(AM|PM)/i, "");
  return ` · ${h} ET`;
}

/** " · 9 PM ET" for the session date block. */
function etFull(iso: string, tz?: string | null): string {
  if (!tz || !tz.includes("Los_Angeles")) return "";
  return ` · ${new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "America/New_York" }).format(new Date(iso))} ET`;
}

function Missing({ kicker, title }: { kicker: string; title: string }) {
  return (
    <OfferFrame gk="ser" kicker={kicker} title={title}>
      <p className="osf-note">This series is not available any more.</p>
    </OfferFrame>
  );
}

// ── ser-offer ───────────────────────────────────────────────────────────────

export function SeriesOffer({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const [all, setAll] = React.useState(false);
  const now = useNowMs();
  const o = env.findOffer(props.key);
  if (!o) return <Missing kicker="Series" title="Series" />;
  const { next, earlier } = seriesSessions(o);
  // When even the newest session is over, it is the latest, not the next.
  const nextOver = Boolean(next && now != null && startEnded(next.start, now));
  const tz = o.when?.timeZone;
  const hosts = hostsOf(env, o);
  const strip: Array<[string, string]> = [];
  if (o.when?.start) {
    const t = dateBlock(o.when.start, tz).time.replace(":00", "").toLowerCase();
    strip.push(["WHEN", weekdayPlural(o.when.start, tz)]);
    strip.push(["TIME", `${t}${tzShort(tz) ? ` ${tzShort(tz)}` : ""}${tzPair(o.when.start, tz)}`]);
  }
  strip.push(["WHERE", `${o.venue?.online ? "Online" : (o.venue?.name ?? "")}${o.price ? "" : " · free"}`]);
  const ctx = { ...props.ctx, flow: "ser" as const };

  return (
    <OfferFrame
      gk="ser"
      kicker="Series"
      title={o.title}
      status={o.when?.start ? `Weekly · ${weekdayPlural(o.when.start, tz)} · free` : undefined}
      primary={{ label: "Subscribe", onClick: () => push(offerDescriptor("ser-sub", o.key, ctx)) }}
      headAction={{ icon: "↗", label: "Share", onClick: () => push(offerDescriptor("share", o.key)) }}
      picture={o.poster ?? o.images?.[0] ?? null}
    >
      {o.standfirst && <div className="osf-ser-line">{o.standfirst}</div>}
      <Prose text={o.description} />
      <dl className="osf-ser-strip">
        {strip.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd suppressHydrationWarning>{v}</dd>
          </div>
        ))}
      </dl>
      {hosts.length > 0 && (
        <div className="osf-ser-hosts">
          <span className="osf-ser-faces">
            {hosts.slice(0, 3).map((h) => (
              <Avatar key={h.id} src={h.portrait} size={24} />
            ))}
          </span>
          <span className="osf-dim">
            Hosted by{" "}
            {hosts.map((h, i) => (
              <React.Fragment key={h.id}>
                {i > 0 && (i === hosts.length - 1 ? " and " : ", ")}
                <PersonName id={h.id} />
              </React.Fragment>
            ))}
          </span>
        </div>
      )}
      {next && (
        <>
          <span className="osf-label">{nextOver ? "Latest session" : "Next session"}</span>
          <button type="button" className="osf-ser-next" onClick={() => push(offerDescriptor("ser-session", o.key, { ...ctx, slotId: String(next.n) }))}>
            <span className="osf-ser-date" suppressHydrationWarning>
              <span>{dateBlock(next.start, tz).weekday}</span>
              <b>{dateBlock(next.start, tz).day}</b>
              <span>{dateBlock(next.start, tz).month}</span>
            </span>
            <span className="osf-ser-nt">
              <span>{next.title}</span>
              <span className="osf-mono-meta">
                SESSION {next.n} · {(hosts[0]?.name ?? "").toUpperCase()}
              </span>
            </span>
            <span className="osf-ser-arrow" aria-hidden>
              →
            </span>
          </button>
        </>
      )}
      {earlier.length > 0 && (
        <div className="osf-ser-earlier">
          <button type="button" className="osf-ser-toggle" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? "▾" : "▸"} EARLIER SESSIONS ({earlier.length})
          </button>
          {all && (
            <ul className="osf-ser-list">
              {earlier.map((s) => (
                <li key={s.n}>
                  <button type="button" onClick={() => push(offerDescriptor("ser-session", o.key, { ...ctx, slotId: String(s.n) }))}>
                    <span className="osf-mono-meta">{s.n}</span>
                    <span>{s.title}</span>
                    <span className="osf-mono-meta" suppressHydrationWarning>
                      {shortWhen(s.start, tz)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </OfferFrame>
  );
}

// ── ser-sub ─────────────────────────────────────────────────────────────────

export function SeriesSub({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const from = useFlowOrigin();
  const viewer = env.data.viewer;
  const o = env.findOffer(props.key);
  const [email, setEmail] = React.useState(viewer?.email ?? "");
  const [error, setError] = React.useState<string | null>(null);

  // There is no subscribe action in SurfaceActions yet: nothing is sent, the
  // flow goes straight on to "done".
  const submit = () => {
    if (!o) return;
    setError(null);
    if (!viewer?.signedIn && !gate && !isEmail(email)) return setError("Add an email address so the reminders can reach you.");
    push(offerDescriptor("done", o.key, { ...props.ctx, flow: "ser", from }));
  };
  // Decision 16: subscribing is following the series, which needs an account. Signed out, the primary asks for one.
  const { gate, ask } = useJoinGate("sub", props.key, "ser", submit);
  if (!o) return <Missing kicker="Subscribe" title="Subscribe to the series?" />;

  return (
    <OfferFrame gk="ser" kicker="Subscribe" title="Subscribe to the series?" status="One email per session" primary={{ label: "Subscribe", onClick: gate ? ask : submit }} picture={o.poster ?? o.images?.[0] ?? null}>
      <p className="osf-text">We&apos;ll send a reminder a couple of days before each session, with its details and the join link.</p>
      <p className="osf-note">Subscribing doesn&apos;t mark you as coming. Each email lets you say you&apos;re coming to that session.</p>
      {!viewer?.signedIn && !gate && <Field label="EMAIL" type="email" value={email} onChange={setEmail} autoComplete="email" />}
      <Failure error={error} />
    </OfferFrame>
  );
}

// ── ser-session ─────────────────────────────────────────────────────────────

export function SeriesSession({ props }: { props: OfferProps }) {
  const env = useOfferEnv();
  const { push } = useSurface();
  const now = useNowMs();
  const o = env.findOffer(props.key);
  if (!o) return <Missing kicker="Session" title="Session" />;
  const { next, earlier } = seriesSessions(o);
  const wanted = Number(props.ctx?.slotId);
  const s = [next, ...earlier].find((x) => x && x.n === wanted) ?? next;
  if (!s) return <Missing kicker="Session" title="Session" />;
  const tz = o.when?.timeZone;
  const b = dateBlock(s.start, tz);
  const hosts = hostsOf(env, o);
  // A session that is over takes no RSVP.
  const upcoming = (next ? s.n === next.n : true) && !(now != null && startEnded(s.start, now));

  return (
    <OfferFrame
      gk="ser"
      kicker={`Session ${s.n}`}
      title={s.title}
      status={
        <span suppressHydrationWarning>
          {b.weekday} {b.day} {b.month} · {b.time.replace(":00", "")}
          {tzShort(tz) ? ` ${tzShort(tz)}` : ""}
        </span>
      }
      primary={upcoming ? { label: "I'm coming", onClick: () => push(offerDescriptor("evt-rsvp", o.key, { ...props.ctx, flow: "evt" })) } : undefined}
      headAction={{ icon: "↗", label: "Share", onClick: () => push(offerDescriptor("share", o.key)) }}
      picture={o.poster ?? o.images?.[0] ?? null}
    >
      <div className="osf-ser-sdate">
        <b suppressHydrationWarning>{b.day}</b>
        <span className="osf-mono-meta" suppressHydrationWarning>
          {b.weekday} · {b.month}
          <br />
          {b.time.replace(":00", "")}
          {tzShort(tz) ? ` ${tzShort(tz)}` : ""}
          {etFull(s.start, tz)} · {o.venue?.online ? "ONLINE" : (o.venue?.name ?? "").toUpperCase()}
        </span>
      </div>
      {hosts.length > 0 && (
        <div className="osf-ser-host">
          <Avatar src={hosts[0]!.portrait} size={24} />
          <span>
            {hosts.map((h, i) => (
              <React.Fragment key={h.id}>
                {i > 0 && (i === hosts.length - 1 ? " and " : ", ")}
                <PersonName id={h.id} />
              </React.Fragment>
            ))}
          </span>
        </div>
      )}
      <Prose text={s.description} />
      {s.file && (
        <div className="osf-ser-file">
          <span>▭ {s.file.name}</span>
          <span className="osf-mono-meta">{s.file.size}</span>
        </div>
      )}
      <span className="osf-note">Part of {o.title}. Subscribers get the join link by email.</span>
    </OfferFrame>
  );
}
