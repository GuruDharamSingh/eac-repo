"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { BookingForm } from "@/components/tours/booking-form";
import { RoutePreviewLauncher } from "@/components/tours/route-preview-launcher";
import { TourCard } from "@/components/tours/tour-card";
import { TourStory } from "@/components/tours/tour-story";
import { formatDuration, formatPrice } from "@/lib/tour-format";
import { useTourEdit, useTourPage, type TourDraft } from "./context";

/**
 * The tour page as blocks. Each block takes only its own settings as props
 * (what a Puck document stores) and reads the tour from TourPageProvider.
 * While an editor has "Edit page" on, the parts that belong to the tour —
 * title, intro, facts, text, highlights, price, film — turn into fields in
 * place; stops and dates stay in the manage console, linked from the bar.
 */

// ── small editing controls ────────────────────────────────────────────────

const fieldRing = "rounded-sm outline outline-1 outline-dashed outline-[color:var(--brass,#c9a25c)] outline-offset-4 bg-transparent";

function InlineText(p: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; multiline?: boolean; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [p.value]);
  if (!p.multiline) {
    return <input aria-label={p.label} value={p.value} placeholder={p.placeholder} onChange={(e) => p.onChange(e.target.value)} className={`${fieldRing} w-full ${p.className ?? ""}`} />;
  }
  return <textarea ref={ref} aria-label={p.label} rows={1} value={p.value} placeholder={p.placeholder} onChange={(e) => p.onChange(e.target.value)} className={`${fieldRing} block w-full resize-none overflow-hidden ${p.className ?? ""}`} />;
}

function LinesField(p: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <InlineText multiline label={p.label} value={p.value.join("\n")} placeholder="One per line" onChange={(v) => p.onChange(v.split("\n"))} className="text-sm" />
  );
}

function NumberField(p: { label: string; value: number | null; onChange: (v: number | null) => void; suffix?: string; step?: number }) {
  return (
    <label className="inline-flex items-baseline gap-1">
      <input
        aria-label={p.label}
        type="number"
        min={0}
        step={p.step ?? 1}
        value={p.value ?? ""}
        onChange={(e) => p.onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={`${fieldRing} w-20 text-right`}
      />
      {p.suffix && <span className="text-muted-foreground">{p.suffix}</span>}
    </label>
  );
}

async function upload(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
  return json.url;
}

function UploadButton(p: { accept: string; label: string; onUrl: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <label className="cursor-pointer rounded bg-background/90 px-3 py-1.5 text-xs shadow backdrop-blur">
      {busy ? "Uploading…" : err ? `${p.label} (${err})` : p.label}
      <input
        type="file"
        accept={p.accept}
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setErr(null);
          try { p.onUrl(await upload(f)); } catch (x) { setErr(x instanceof Error ? x.message : "failed"); }
          setBusy(false);
        }}
      />
    </label>
  );
}

// ── blocks ────────────────────────────────────────────────────────────────

export interface TourFilmProps { size: "wide" | "narrow"; interactive: boolean }

/**
 * The film as the page's hero; without one, the interactive route preview or the cover image (the earlier hero).
 * Always the whole 16:9 frame, never cropped: Google's attribution and "For promotional purposes only" are
 * burned into its edges and must stay visible (Map Tiles terms).
 */
export function TourFilmBlock({ size, interactive }: TourFilmProps) {
  const page = useTourPage();
  const { editing, draft, set } = useTourEdit();
  const film = draft?.film ?? null;
  const [src, setSrc] = useState<string | null>(film ? film.url720 ?? film.url : null);
  useEffect(() => {
    if (!film) { setSrc(null); return; }
    setSrc(window.matchMedia("(min-width: 900px)").matches ? film.url : film.url720 ?? film.url);
  }, [film]);
  if (!page) return null;
  const { tour } = page;
  const placed = tour.stops.some((s) => s.lat != null);
  const stops = tour.stops.map((s) => ({ ...s, guideNotes: null }));
  const meetingPoint = tour.details.meetingPoint ? { ...tour.details.meetingPoint, label: tour.location } : null;
  const launcher = (hero: boolean) => (
    <RoutePreviewLauncher
      hero={hero}
      title={tour.title}
      stops={stops}
      meetingPoint={meetingPoint}
      route={tour.details.route}
      googleMapsKey={page.googleMapsKey}
      coverImageUrl={tour.coverImageUrl ?? tour.stops.find((s) => s.stillUrl)?.stillUrl ?? null}
    />
  );
  const setFilm = (f: TourDraft["film"]) => set("film", f);

  const controls = editing && (
    <div className="absolute right-3 top-3 z-20 flex flex-wrap gap-2">
      <UploadButton accept="video/mp4,video/webm" label={film ? "Replace film" : "Add a film"} onUrl={(url) => setFilm({ url, url720: null, poster: film?.poster ?? tour.coverImageUrl })} />
      {film && <UploadButton accept="image/*" label="Replace poster" onUrl={(poster) => setFilm({ ...film, poster })} />}
      {film && <button type="button" className="rounded bg-background/90 px-3 py-1.5 text-xs shadow" onClick={() => setFilm(null)}>Remove film</button>}
    </div>
  );

  if (!film) {
    return (
      <header className="relative">
        {controls}
        {placed ? (
          <div className="mx-auto max-w-6xl px-0 sm:px-5 sm:pt-6">{launcher(true)}</div>
        ) : tour.coverImageUrl ? (
          <div className="aspect-[21/9] max-h-[70vh] w-full overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tour.coverImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : editing ? <div className="aspect-[21/9] w-full bg-muted" /> : null}
      </header>
    );
  }

  return (
    <header className="relative">
      <div className={`mx-auto px-0 sm:px-5 sm:pt-6 ${size === "narrow" ? "max-w-4xl" : "max-w-6xl"}`}>
        <div className="tour-film relative aspect-video w-full overflow-hidden bg-black">
          {controls}
          {src && (
            <video key={src} className="h-full w-full object-contain" src={src} poster={film.poster ?? undefined} autoPlay muted loop playsInline preload="metadata" aria-label={`A flight along the route of ${tour.title}`} />
          )}
        </div>
      </div>
      {interactive && placed && <div className="mx-auto mt-8 max-w-6xl px-5">{launcher(false)}</div>}
    </header>
  );
}

export interface TourIntroProps { showFacts: boolean }

/** Back link, title, intro line and the facts row. */
export function TourIntroBlock({ showFacts }: TourIntroProps) {
  const page = useTourPage();
  const { editing, draft, set } = useTourEdit();
  if (!page || !draft) return null;
  const length = formatDuration(draft.durationMinutes);
  const facts: { k: string; v: ReactNode }[] = editing
    ? [
        { k: "Length", v: <NumberField label="Length in minutes" value={draft.durationMinutes} onChange={(v) => set("durationMinutes", v)} suffix="min" step={15} /> },
        { k: "Language", v: <InlineText label="Languages" value={draft.languages.join(", ")} onChange={(v) => set("languages", v.split(","))} placeholder="English, Français" className="w-48" /> },
        { k: "Walking", v: <InlineText label="Walking" value={draft.effort} onChange={(v) => set("effort", v)} placeholder="Easy, 3 km, cobbles" className="w-56" /> },
        { k: "Group", v: <NumberField label="Largest group" value={draft.maxParty} onChange={(v) => set("maxParty", v)} suffix="people" /> },
        { k: "Meet at", v: <InlineText label="Meeting point" value={draft.location} onChange={(v) => set("location", v)} placeholder="Where the guide waits" className="w-72" /> },
      ]
    : ([
        length ? { k: "Length", v: length } : null,
        draft.languages.length ? { k: "Language", v: draft.languages.join(", ") } : null,
        draft.effort ? { k: "Walking", v: draft.effort } : null,
        draft.maxParty ? { k: "Group", v: `up to ${draft.maxParty}` } : null,
        draft.location ? { k: "Meet at", v: draft.location } : null,
      ].filter(Boolean) as { k: string; v: ReactNode }[]);

  return (
    <div className="mx-auto max-w-6xl px-5 pt-10">
      <Link href="/tours" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← All tours</Link>
      {draft.status !== "published" && (
        <span className="ml-3 rounded bg-secondary px-2 py-0.5 text-xs">Draft — only editors can see this</span>
      )}
      {editing ? (
        <InlineText label="Title" multiline value={draft.title} onChange={(v) => set("title", v)} className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl" />
      ) : (
        <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">{draft.title}</h1>
      )}
      {editing ? (
        <InlineText label="Intro" multiline value={draft.excerpt} onChange={(v) => set("excerpt", v)} placeholder="One or two sentences for cards and search results" className="mt-4 max-w-2xl text-lg text-muted-foreground" />
      ) : (
        draft.excerpt && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{draft.excerpt}</p>
      )}
      {showFacts && facts.length > 0 && (
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {facts.map((f) => (
            <div key={f.k} className="flex items-baseline gap-2">
              <dt className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export interface TourMainProps { showHighlights: boolean; showRoute: boolean; routeHeading: string; showBooking: boolean }

/** The description, highlights, the stop-by-stop route and the booking box beside them. */
export function TourMainBlock({ showHighlights, showRoute, routeHeading, showBooking }: TourMainProps) {
  const page = useTourPage();
  const { editing, draft, set } = useTourEdit();
  if (!page || !draft) return null;
  const { tour } = page;
  const meetingPoint = tour.details.meetingPoint ? { ...tour.details.meetingPoint, label: draft.location || null } : null;
  const priceLabel = formatPrice(draft.price, tour.currency);

  const lists = showHighlights && (editing || draft.highlights.length > 0 || draft.includes.length > 0) && (
    <div className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-2">
      {(["highlights", "includes"] as const).map((key) => {
        const items = draft[key];
        if (!editing && items.length === 0) return null;
        return (
          <section key={key}>
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{key === "highlights" ? "Highlights" : "Included"}</h2>
            <div className="mt-2">
              {editing ? (
                <LinesField label={key} value={items} onChange={(v) => set(key, v)} />
              ) : (
                <ul className="space-y-1 text-sm">{items.map((h) => <li key={h}>— {h}</li>)}</ul>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <div className={`mx-auto max-w-6xl px-5 py-10 ${showBooking ? "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12" : ""}`}>
      <div className="min-w-0">
        {editing ? (
          <div className="max-w-2xl">
            <RichTextEditor value={draft.body} onChange={(html) => set("body", html)} placeholder="What the walk is about, in your own words" minHeight={180} toolbar="compact" ariaLabel="Tour description" />
          </div>
        ) : (
          draft.body && (
            <div className="eac-article max-w-2xl" data-layout="note">
              <div className="eac-article__body" dangerouslySetInnerHTML={{ __html: draft.body }} />
            </div>
          )
        )}
        {lists}
        {showRoute && (tour.stops.length > 0 || meetingPoint) && (
          <section className="mt-14">
            <h2 className="font-serif text-2xl">{routeHeading || "The route"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tour.stops.length} stop{tour.stops.length === 1 ? "" : "s"}. Scroll through them; the map follows.
              {editing && <> <Link href={`/manage/tours/${tour.id}?tab=stops`} className="underline underline-offset-4">Edit the stops</Link></>}
            </p>
            <div className="mt-6">
              <TourStory
                stops={tour.stops.map((s) => ({ ...s, guideNotes: null }))}
                meetingPoint={meetingPoint}
                googleMapsKey={page.googleMapsKey}
                businesses={Object.fromEntries(
                  Object.entries((tour as { stopExtras?: Record<string, { business?: import("@/lib/catalogue-types").PlaceBusinessSummary | null }> }).stopExtras ?? {}).map(([id, x]) => [id, x.business ?? null])
                )}
              />
            </div>
          </section>
        )}
      </div>

      {showBooking && (
        <aside id="book" className="mt-12 lg:mt-0">
          <div className="sticky top-24 border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Book</p>
            {editing ? (
              <p className="mt-1 font-serif text-2xl"><NumberField label="Price per person" value={draft.price} onChange={(v) => set("price", v)} suffix={`${tour.currency} per person`} /></p>
            ) : (
              <p className="mt-1 font-serif text-2xl">{priceLabel} <span className="text-base text-muted-foreground">per person</span></p>
            )}
            <div className="mt-5">
              <Suspense>
                <BookingForm
                  tourSlug={tour.slug}
                  departures={tour.departures}
                  priceLabel={priceLabel}
                  pricePerPerson={draft.price}
                  currency={tour.currency}
                  maxParty={page.maxParty}
                  unavailable={page.unavailable}
                  signedInEmail={page.signedInEmail}
                />
              </Suspense>
            </div>
            {tour.authorName && (
              <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
                Led by <span className="text-foreground">{tour.authorName}</span>
              </p>
            )}
            {editing && (
              <Link href={`/manage/tours/${tour.id}?tab=departures`} className="mt-3 inline-block text-xs underline underline-offset-4">Dates and capacity</Link>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

export interface TourMoreProps { heading: string; count: number }

/** Other tours, as cards. */
export function TourMoreBlock({ heading, count }: TourMoreProps) {
  const page = useTourPage();
  if (!page || page.others.length === 0 || count <= 0) return null;
  return (
    <section className="mx-auto max-w-6xl border-t border-border px-5 py-14">
      <h2 className="font-serif text-2xl">{heading || "More tours"}</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {page.others.slice(0, count).map(({ tour, next }) => <TourCard key={tour.id} tour={tour} next={next} />)}
      </div>
    </section>
  );
}

export interface TourTextProps { heading: string; text: string }

/** A heading and a paragraph that appear on every tour page (practical notes, a policy line). */
export function TourTextBlock({ heading, text }: TourTextProps) {
  if (!heading && !text) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-8">
      <div className="max-w-2xl">
        {heading && <h2 className="font-serif text-2xl">{heading}</h2>}
        {text && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{text}</p>}
      </div>
    </section>
  );
}
