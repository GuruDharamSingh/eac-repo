"use client";

import { SAMPLE_EXPERIENCE as E, SAMPLE_OTHER_EXPERIENCES, art } from "./data";
import { Anchor, BookBox, ExperienceCardMock, Facts, Initials, WebFrame } from "./web-parts";

// Static mocks of the experience page blocks (apps/elktours/src/blocks/experience/blocks.tsx). The experience
// comes from ./data instead of ExperiencePageProvider.

const GRID = { display: "grid", gridTemplateColumns: "minmax(0,1fr) 22rem", gap: "3rem" } as const;

export function ExperienceHero() {
  return (
    <WebFrame>
      <header className="mx-auto max-w-6xl px-0 sm:px-5 sm:pt-6">
        <div className="aspect-[21/9] max-h-[70vh] w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={E.cover} alt="" className="h-full w-full object-cover" />
        </div>
      </header>
    </WebFrame>
  );
}

export function ExperienceIntro() {
  return (
    <WebFrame>
      <div className="mx-auto max-w-6xl px-5 pt-10">
        <Anchor className="text-sm text-muted-foreground underline-offset-4 hover:underline">{"←"} All experiences</Anchor>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">{E.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{E.excerpt}</p>
        <Facts items={[{ k: "Format", v: E.format }, { k: "Where", v: E.where }, { k: "Length", v: E.length }, { k: "From", v: E.from }]} />
      </div>
    </WebFrame>
  );
}

export function ExperienceMain() {
  const groups = [
    { label: "Artist", list: E.people.filter((p) => p.role === "artist") },
    { label: "Host", list: E.people.filter((p) => p.role === "host") },
  ];
  return (
    <WebFrame>
      <div className="mx-auto max-w-6xl px-5 py-10" style={GRID}>
        <div className="min-w-0">
          <div className="eac-article max-w-2xl" data-layout="note">
            <div className="eac-article__body" dangerouslySetInnerHTML={{ __html: E.body }} />
          </div>
          <section className="mt-8 max-w-2xl">
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Highlights</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {E.highlights.map((h) => (
                <li key={h}>{"—"} {h}</li>
              ))}
            </ul>
          </section>
          <div className="mt-12 max-w-2xl space-y-6 border-t border-border pt-8">
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{g.label}</h2>
                <ul className="mt-3 space-y-3">
                  {g.list.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <Initials name={p.name} size={44} />
                      <div className="min-w-0">
                        <p className="font-serif text-lg leading-tight">{p.name}</p>
                        <p className="text-sm underline underline-offset-4">Profile {"↗"}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
        <BookBox label="Ask about it" priceLine={<>{E.from} <span className="text-base text-muted-foreground">{E.priceNote}</span></>} note="Tell us when you would like to come and how many you are; we arrange the rest by email.">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-3 text-sm">
            <label className="block">
              Your email
              <input className="em-field" type="email" placeholder="you@example.org" />
            </label>
            <label className="block">
              Message
              <textarea className="em-field" rows={3} placeholder="When, and how many?" />
            </label>
            <button type="button" className="em-btn">Send the enquiry</button>
          </form>
        </BookBox>
      </div>
    </WebFrame>
  );
}

export function ExperienceGallery() {
  return (
    <WebFrame>
      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="font-serif text-2xl">In pictures</h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {E.images.map((src, i) => (
            <li key={i} className="aspect-[4/3] overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </li>
          ))}
        </ul>
      </section>
    </WebFrame>
  );
}

export function ExperienceMore() {
  return (
    <WebFrame>
      <section className="mx-auto max-w-6xl border-t border-border px-5 py-14">
        <h2 className="font-serif text-2xl">More experiences</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_OTHER_EXPERIENCES.map((x) => (
            <ExperienceCardMock key={x.id} title={x.title} excerpt={x.excerpt} facts={x.facts} artist={x.artist} price={x.price} where={x.where} src={art(x.hue, x.title, 640, 480)} />
          ))}
        </div>
      </section>
    </WebFrame>
  );
}

export function ExperienceText() {
  return (
    <WebFrame>
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="max-w-2xl">
          <h2 className="font-serif text-2xl">Good to know</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{"Studios are on upper floors without a lift.\nWe confirm the time by email within two days."}</p>
        </div>
      </section>
    </WebFrame>
  );
}
