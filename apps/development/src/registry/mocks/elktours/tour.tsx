"use client";

import { SAMPLE_OTHER_TOURS, SAMPLE_TOUR as T, art } from "./data";
import { Anchor, BookBox, Facts, RouteSketch, TourCardMock, WebFrame } from "./web-parts";

// Static mocks of the tour page blocks (apps/elktours/src/blocks/tour/*). Markup and classes follow the source;
// the tour comes from ./data instead of TourPageProvider, and the booking form is a plain look-alike.

const GRID = { display: "grid", gridTemplateColumns: "minmax(0,1fr) 22rem", gap: "3rem" } as const;

export function TourFilm() {
  return (
    <WebFrame>
      <header className="relative">
        <div className="mx-auto max-w-6xl px-0 sm:px-5 sm:pt-6">
          <div className="tour-film relative mx-auto aspect-video w-full overflow-hidden bg-black" style={{ maxWidth: "calc(60vh * 16 / 9)" }}>
            <button type="button" className="tour-film__poster group absolute inset-0 block h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={T.poster} alt="" className="h-full w-full object-contain" />
              <span className="tour-film__play absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg">
                <span aria-hidden>▶</span> Watch the fly-over
              </span>
            </button>
          </div>
        </div>
      </header>
    </WebFrame>
  );
}

export function TourIntro() {
  const facts = [
    { k: "Length", v: "2 h 30" },
    { k: "Language", v: T.languages.join(", ") },
    { k: "Walking", v: T.effort },
    { k: "Group", v: `up to ${T.maxParty}` },
    { k: "Meet at", v: T.location },
  ];
  return (
    <WebFrame>
      <div className="mx-auto max-w-6xl px-5 pt-10">
        <Anchor className="text-sm text-muted-foreground underline-offset-4 hover:underline">{"←"} All tours</Anchor>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">{T.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{T.excerpt}</p>
        <Facts items={facts} />
      </div>
    </WebFrame>
  );
}

export function TourMain() {
  return (
    <WebFrame>
      <div className="mx-auto max-w-6xl px-5 py-10" style={GRID}>
        <div className="min-w-0">
          <div className="eac-article max-w-2xl" data-layout="note">
            <div className="eac-article__body" dangerouslySetInnerHTML={{ __html: T.body }} />
          </div>
          <div className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
            {([["Highlights", T.highlights], ["Included", T.includes]] as const).map(([h, items]) => (
              <section key={h}>
                <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{h}</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {items.map((i) => (
                    <li key={i}>{"—"} {i}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <section className="mt-14">
            <h2 className="font-serif text-2xl">The route</h2>
            <p className="mt-1 text-sm text-muted-foreground">{T.stops.length} stops. Scroll through them; the map follows.</p>
            <div className="mt-6" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "1.5rem" }}>
              <ol className="space-y-4">
                {T.stops.map((s, i) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="em-stop-n">{i + 1}</span>
                    <div>
                      <p className="font-serif text-lg leading-tight">{s.name}</p>
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{s.when}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <RouteSketch stops={T.stops.length} />
            </div>
          </section>
        </div>
        <BookBox label="Book" priceLine={<>{T.priceLabel} <span className="text-base text-muted-foreground">per person</span></>}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-3 text-sm">
            <label className="block">
              Date
              <select className="em-field" defaultValue="d1">
                {T.departures.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.day}, {d.time} ({d.left})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Guests
              <input className="em-field" type="number" defaultValue={2} min={1} max={T.maxParty} />
            </label>
            <label className="block">
              Email
              <input className="em-field" type="email" placeholder="you@example.org" />
            </label>
            <button type="button" className="em-btn">Reserve</button>
          </form>
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
            Led by <span className="text-foreground">{T.authorName}</span>
          </p>
        </BookBox>
      </div>
    </WebFrame>
  );
}

export function TourMore() {
  return (
    <WebFrame>
      <section className="mx-auto max-w-6xl border-t border-border px-5 py-14">
        <h2 className="font-serif text-2xl">More tours</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_OTHER_TOURS.map((t) => (
            <TourCardMock key={t.id} title={t.title} excerpt={t.excerpt} meta={`${t.duration} · ${t.language}`} price={t.price} next={t.next} src={art(t.hue, t.title, 640, 480)} />
          ))}
        </div>
      </section>
    </WebFrame>
  );
}

export function TourText() {
  return (
    <WebFrame>
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="max-w-2xl">
          <h2 className="font-serif text-2xl">Good to know</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {"Wear comfortable shoes; the passages are cobbled.\nFree cancellation up to 48 hours before the start."}
          </p>
        </div>
      </section>
    </WebFrame>
  );
}

/** The Hero stage block: the tour page's stage (narrative and stops on the left, photos or the 3D route on the right). */
export function TourStage() {
  return (
    <WebFrame>
      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="border border-border bg-card" style={{ display: "grid", gridTemplateColumns: "minmax(0,5fr) minmax(0,7fr)", minHeight: 480 }}>
          <div className="flex flex-col gap-4 p-6">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{T.stops.length} stops {"·"} 2 h 30</span>
            <p className="font-serif text-xl leading-snug">{T.excerpt}</p>
            <button type="button" className="flex items-center gap-3 border-t border-border pt-4 text-left text-sm">
              <span className="font-mono text-primary">1</span> Start at {T.stops[0]?.name} {"→"}
            </button>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {T.highlights.map((h) => (
                <li key={h}>{"—"} {h}</li>
              ))}
            </ul>
            <div className="mt-auto flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-serif text-2xl">{T.priceLabel}</span>
              <span className="em-btn" style={{ width: "auto" }}>Choose a date</span>
            </div>
          </div>
          <div className="relative bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={T.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="absolute inset-x-4 bottom-4 flex gap-2">
              {T.stops.map((s) => (
                <span key={s.id} className="flex-1 border border-border bg-background/90 px-2 py-1 text-center text-[0.7rem]">{s.name}</span>
              ))}
            </div>
            <span className="absolute left-3 top-3 bg-background/90 px-3 py-1 text-xs">Photos {"·"} Street view</span>
          </div>
        </div>
      </section>
    </WebFrame>
  );
}
