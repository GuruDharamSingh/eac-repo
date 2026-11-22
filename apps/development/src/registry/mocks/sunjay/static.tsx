"use client";

import type { ReactNode } from "react";
import { kindMeta } from "@elkdonis/cms-ui/surface";
import "@elkdonis/cms-ui/surface.css";
import "./sunjay-mock.css";
import { EVENT, GUIDE, ME, SERVICES, THREADS, placeholder, type MockService, type MockThread } from "./sample";

// Static mocks: the markup and class names of Sunjay's blocks, copied from apps/sunjay/src (data-blocks,
// views.client, event.client, service-blocks, offering-card.client, profile-card, thread-card, signup-card,
// rsvp-panel, attendee-list). Nothing here runs: no forms submit, no fetch, no router. Content is invented.

const PRIMARY_BTN =
  "border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))]";
const QUIET_BTN = "border border-input bg-background px-4 py-2 text-sm text-foreground";

// ── profile card ────────────────────────────────────────────────────────────

export function Profile() {
  return (
    <article className="card-natural overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={GUIDE.photoUrl} alt={GUIDE.displayName} className="block aspect-[4/3] w-full object-cover" />
      <div className="p-6">
        <h3 className="font-serif text-xl font-semibold leading-tight">{GUIDE.displayName}</h3>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--rust))]">{GUIDE.roleTitle}</p>
        <p className="mt-4 leading-relaxed text-muted-foreground">{GUIDE.bio}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a className="border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))]">Read more</a>
          {GUIDE.links.map((l) => (
            <a key={l.label} className={l.emphasis ? "border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))]" : "border border-border bg-background px-4 py-2 text-sm text-foreground"}>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}

// ── posts: cards ────────────────────────────────────────────────────────────

function ThreadCard({ t, feedName }: { t: MockThread; feedName?: string }) {
  const meta = kindMeta(t.kind);
  return (
    <article className="eac-face eac-face--row" data-kind={t.kind}>
      <a className="eac-face-hit" aria-label={`Open ${t.title}`} />
      {t.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="eac-face-cover" src={t.cover} alt="" />
      ) : null}
      <span className="eac-face-kicker">{[meta.label, feedName].filter(Boolean).join(" · ")}</span>
      <span className="eac-face-title">
        <a className="eac-face-live" style={{ color: "inherit", textDecoration: "none" }}>
          {t.title}
        </a>
      </span>
      <span className="eac-face-blurb">{t.excerpt}</span>
      <div className="eac-face-meta">
        {t.when ? (
          <span>
            <b>{t.when.split(" · ")[0]}</b> · {t.when.split(" · ")[1]}
            {t.duration ? ` · ${t.duration}` : ""}
          </span>
        ) : null}
        {t.recurrence ? <span>{t.recurrence}</span> : null}
        {t.place ? <span>{t.place}</span> : null}
        {t.online ? <span>Online</span> : null}
        {t.attending ? (
          <span>
            <b>{t.attending}</b> coming
          </span>
        ) : null}
        <span>with {t.author}</span>
      </div>
      <div className="eac-face-actions">
        <a className="eac-btn eac-btn--quiet" style={{ padding: "4px 8px" }}>
          Open page →
        </a>
      </div>
    </article>
  );
}

export function Threads() {
  return (
    <div className="pb-6">
      <h2 className="font-serif text-2xl">Suggested materials</h2>
      <hr className="saffron-divider max-w-[12rem]" />
      <div className="space-y-4">
        {THREADS.slice(0, 3).map((t) => (
          <ThreadCard key={t.id} t={t} feedName="Materials" />
        ))}
      </div>
    </div>
  );
}

// ── sign up / your membership (the signed-in half, with a signed-in sample member) ──

function Signup() {
  return (
    <div className="card-natural p-6">
      <h3 className="font-serif text-xl font-semibold">Join us</h3>
      <hr className="saffron-divider !my-4 max-w-[8rem]" />
      <p className="text-sm leading-relaxed text-muted-foreground">Create an account to RSVP for gatherings and follow what&apos;s on. One account works across the whole Arts Collective network.</p>
      <div className="mt-5 flex gap-5 border-b border-border">
        <span className="-mb-px border-b-2 border-[hsl(var(--primary))] pb-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground">Create account</span>
        <span className="-mb-px border-b-2 border-transparent pb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Sign in</span>
      </div>
      <div className="mt-5 space-y-4">
        {["Your name", "Email", "Password"].map((l) => (
          <div key={l}>
            <label className="mk-label">{l}</label>
            <div className="mk-field">&nbsp;</div>
          </div>
        ))}
        <button type="button" className="mk-btn-solid">
          Create account
        </button>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[0.66rem] uppercase tracking-[0.18em] text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <button type="button" className="mt-4 w-full border border-input bg-background px-4 py-2.5 text-sm text-foreground">
        Continue with Google
      </button>
    </div>
  );
}

export function Member() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
      <div>
        <p className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Signed out</p>
        <Signup />
      </div>
      <div className="space-y-6">
        <p className="-mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Signed in</p>
        <div className="card-natural p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-muted text-xl text-muted-foreground">{ME.name.charAt(0)}</div>
            <div className="min-w-0">
              <h2 className="truncate font-serif text-xl font-semibold">{ME.name}</h2>
              <p className="truncate text-sm text-muted-foreground">{ME.headline}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a className={PRIMARY_BTN}>Go to the hub</a>
            <a className={QUIET_BTN}>Account</a>
          </div>
        </div>
        <div className="card-natural p-6">
          <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your membership</h3>
          <p className="mt-3 text-sm leading-relaxed">
            You are a member of <strong>{ME.orgName}</strong>.
          </p>
          <h4 className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">You&rsquo;re coming to</h4>
          <ul className="mt-2 space-y-2">
            {ME.rsvps.map((r) => (
              <li key={r.id} className="text-sm">
                <a className="font-medium">{r.title}</a>
                <span className="block text-xs text-muted-foreground">{r.when}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── event blocks ────────────────────────────────────────────────────────────

export function EventHeader() {
  const facts: Array<[string, string]> = [
    ["Next", EVENT.next],
    ["Length", EVENT.length],
    ["Where", EVENT.where],
    ["Host", EVENT.host],
  ];
  return (
    <header className="grid gap-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-end">
      <div>
        <a className="text-sm text-muted-foreground underline-offset-4">{EVENT.crumb}</a>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[hsl(var(--primary))]">{EVENT.kicker}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{EVENT.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">{EVENT.excerpt}</p>
        <dl className="mt-6 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{k}</dt>
              <dd className="mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={EVENT.cover} alt="" className="aspect-[4/3] w-full object-cover" />
    </header>
  );
}

export function EventAbout() {
  return (
    <section>
      <h2 className="font-serif text-2xl">About this gathering</h2>
      <hr className="saffron-divider max-w-[12rem]" />
      <div className="max-w-3xl leading-relaxed">
        {EVENT.description.map((p) => (
          <p key={p} className="mb-4">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

export function TalkRoom() {
  return (
    <section className="card-natural p-6">
      <h2 className="font-serif text-2xl">The room</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">The room opens ten minutes before we start. The session is not recorded.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={PRIMARY_BTN}>
          Join the room
        </button>
        <a className={QUIET_BTN}>Open in a new tab</a>
      </div>
    </section>
  );
}

export function EventRsvp() {
  return (
    <div>
      <section className="card-natural mt-8 p-6">
        <h2 className="font-serif text-xl">Are you coming?</h2>
        <div className="mt-4">
          <p className="mb-4 text-sm text-muted-foreground">
            {EVENT.attending} people have said they&rsquo;re coming · {EVENT.limit} spaces.
          </p>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {["Your name", "Email"].map((l) => (
                <div key={l} className="space-y-1.5">
                  <label className="text-sm font-medium">{l}</label>
                  <div className="mk-field">&nbsp;</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-4 w-4 border border-input bg-[hsl(var(--primary))]" />
              Email me a reminder beforehand
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="mk-btn-solid" style={{ width: "auto", padding: "10px 20px" }}>
                Yes, I&apos;m coming
              </button>
              <span className="text-sm text-muted-foreground">
                or <u>sign in</u> to keep track of your RSVPs
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="mt-6">
        <h2 className="font-serif text-lg">Who&rsquo;s coming</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {EVENT.attendees.map((n) => (
            <li key={n} className="mk-chip">
              <span className="mk-avatar">{n.charAt(0)}</span>
              {n}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">and {EVENT.attending - EVENT.attendees.length} more</p>
      </section>
    </div>
  );
}

export function EventMaterials() {
  return (
    <section>
      <h2 className="font-serif text-2xl">Materials</h2>
      <hr className="saffron-divider max-w-[12rem]" />
      <ul className="space-y-2">
        {EVENT.materials.map((m) => (
          <li key={m.id}>
            <a className="inline-flex items-center gap-2 text-sm underline underline-offset-2">
              <span aria-hidden>⭳</span>
              {m.filename}
              <span className="text-xs text-muted-foreground">({m.kb} KB)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── offering card (classes pt-offer-*, css copied from Sunjay's offering-card.css) ──

export function OfferingCard() {
  return (
    <section className="pt-offer-section">
      <header className="pt-offer-header">
        <p className="pt-offer-eyebrow">Open to everyone</p>
        <h2 className="pt-offer-heading">Current Offerings</h2>
      </header>
      <article className="pt-offer-card">
        <div className="pt-offer-media" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={EVENT.cover} alt="" />
        </div>
        <div className="pt-offer-body">
          <p className="pt-offer-kicker">Weekly · Online</p>
          <h3 className="pt-offer-title">
            <a>{EVENT.title}</a>
          </h3>
          <p className="pt-offer-blurb">{EVENT.description[0]}</p>
          <dl className="pt-offer-facts">
            <div>
              <dt>Time</dt>
              <dd>7:30 p.m. Toronto</dd>
            </div>
            <div>
              <dt>Next</dt>
              <dd>Thu, Dec 3</dd>
            </div>
            <div>
              <dt>Length</dt>
              <dd>{EVENT.length}</dd>
            </div>
          </dl>
          <div className="pt-offer-actions">
            <button type="button" className="pt-offer-btn pt-offer-btn--primary">
              Join the room
            </button>
            <a className="pt-offer-btn">Add to calendar</a>
            <a className="pt-offer-link">Details →</a>
          </div>
        </div>
        <div className="pt-offer-rsvp">
          <section className="card-natural p-6">
            <h2 className="font-serif text-xl">Are you coming?</h2>
            <p className="mt-4 mb-4 text-sm text-muted-foreground">
              {EVENT.attending} people have said they&rsquo;re coming · {EVENT.limit} spaces.
            </p>
            <div className="space-y-3">
              {["Your name", "Email"].map((l) => (
                <div key={l}>
                  <label className="text-sm font-medium">{l}</label>
                  <div className="mk-field">&nbsp;</div>
                </div>
              ))}
              <button type="button" className="mk-btn-solid" style={{ width: "auto", padding: "10px 20px" }}>
                Yes, I&apos;m coming
              </button>
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}

// ── services ────────────────────────────────────────────────────────────────

function Cover({ s }: { s: MockService }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={s.cover || placeholder()} alt="" className="aspect-[16/9] w-full object-cover" />;
}

export function Services() {
  return (
    <section>
      <h2 className="font-serif text-2xl">Services</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Work with Ilan in a small group or one to one.</p>
      <hr className="saffron-divider max-w-[12rem]" />
      <div className="grid gap-6 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <article key={s.id} className="card-natural flex flex-col overflow-hidden">
            <Cover s={s} />
            <div className="flex flex-1 flex-col p-6">
              <p className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--primary))]">{s.facts.slice(0, 2).join(" · ")}</p>
              <h3 className="mt-2 font-serif text-xl">{s.title}</h3>
              <p className="mt-1 text-sm italic text-muted-foreground">{s.subtitle}</p>
              <p className="mt-3 text-sm leading-relaxed">{s.summary}</p>
              <div className="mt-auto flex items-center justify-between pt-5">
                <span className="font-serif text-lg">{s.price}</span>
                <a className={PRIMARY_BTN}>Choose</a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Service() {
  const s = SERVICES[0];
  return (
    <article className="card-natural overflow-hidden">
      <Cover s={s} />
      <div className="p-6">
        <p className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--primary))]">{s.facts.join(" · ")}</p>
        <h2 className="mt-2 font-serif text-3xl">{s.title}</h2>
        <p className="mt-1 italic text-muted-foreground">{s.subtitle}</p>
        <p className="mt-4 font-serif text-2xl">
          {s.price}
          {s.sliding ? <span className="ml-3 font-sans text-sm text-muted-foreground">{s.sliding}</span> : null}
        </p>
        <p className="mt-4 leading-relaxed">{s.summary}</p>
        <div className="mt-4 leading-relaxed">
          {s.body.map((p) => (
            <p key={p} className="mb-3">
              {p}
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}

export function Booking() {
  const s = SERVICES[0];
  const field = (l: string, tall = false) => (
    <div>
      <label className="mk-label">{l}</label>
      <div className="mk-field" style={tall ? { height: 72 } : undefined}>
        &nbsp;
      </div>
    </div>
  );
  return (
    <section className="card-natural p-6">
      <h2 className="font-serif text-2xl">Book</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {s.title} · {s.price}
      </p>
      <div className="mt-4 space-y-4" style={{ maxWidth: 520 }}>
        {field("Your name")}
        {field("Email")}
        <div>
          <label className="mk-label">Amount (pay what you can: CA$40 to CA$80)</label>
          <div className="mk-field">CA$60</div>
        </div>
        {field("Anything we should know before you come? (optional)", true)}
        <button type="button" className="mk-btn-solid">
          Pay and book
        </button>
        <p className="text-xs text-muted-foreground">Mock of the card form: the live one is the shared checkout booking form.</p>
      </div>
    </section>
  );
}

export type { ReactNode };
