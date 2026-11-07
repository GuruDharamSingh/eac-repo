"use client";

import * as React from "react";
import Link from "next/link";
import { ExperienceCard } from "@/components/experiences/experience-card";
import { ExperienceInquiry } from "@/components/experiences/experience-inquiry";
import { PeopleList } from "@/components/experiences/people-chips";
import { FORMAT_LABEL, placeLabel } from "@/components/experiences/types";
import { formatDuration, formatPrice } from "@/lib/tour-format";
import { useExperiencePage } from "./context";

/**
 * The experience page as blocks. Each block takes only its own settings as
 * props (what a Puck document stores) and reads the experience from
 * ExperiencePageProvider. Phase A: read-only blocks; editors change the words
 * in /manage/experiences/[id], linked from the intro.
 */

export interface ExperienceHeroProps { size: "wide" | "narrow" }

/** The cover picture across the top (or the first picture). Nothing when there is none. */
export function ExperienceHeroBlock({ size }: ExperienceHeroProps) {
  const page = useExperiencePage();
  if (!page) return null;
  const src = page.experience.coverImageUrl ?? page.experience.images[0] ?? null;
  if (!src) return null;
  return (
    <header className={`mx-auto px-0 sm:px-5 sm:pt-6 ${size === "narrow" ? "max-w-4xl" : "max-w-6xl"}`}>
      <div className="aspect-[21/9] max-h-[70vh] w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </div>
    </header>
  );
}

export interface ExperienceIntroProps { showFacts: boolean }

/** Back link, title, intro line and the facts row (format, where, length, price). */
export function ExperienceIntroBlock({ showFacts }: ExperienceIntroProps) {
  const page = useExperiencePage();
  if (!page) return null;
  const e = page.experience;
  const length = formatDuration(e.durationMinutes);
  const place = placeLabel(e);
  const facts = [
    { k: "Format", v: FORMAT_LABEL[e.format] },
    place ? { k: "Where", v: place } : null,
    length ? { k: "Length", v: length } : null,
    e.price != null && e.price > 0 ? { k: "From", v: formatPrice(e.price, e.currency) } : null,
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div className="mx-auto max-w-6xl px-5 pt-10">
      <Link href="/experiences" className="text-sm text-muted-foreground underline-offset-4 hover:underline">← All experiences</Link>
      {e.status !== "published" && (
        <span className="ml-3 rounded bg-secondary px-2 py-0.5 text-xs">Draft — only editors can see this</span>
      )}
      {page.canEdit && (
        <Link href={`/manage/experiences/${e.id}`} className="ml-3 text-sm underline underline-offset-4">Edit</Link>
      )}
      <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">{e.title}</h1>
      {e.excerpt && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{e.excerpt}</p>}
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

export interface ExperienceMainProps { showHighlights: boolean; showPeople: boolean; showInquiry: boolean; inquiryHeading: string }

/** The description, highlights and the people, with the inquiry box beside them. */
export function ExperienceMainBlock({ showHighlights, showPeople, showInquiry, inquiryHeading }: ExperienceMainProps) {
  const page = useExperiencePage();
  if (!page) return null;
  const e = page.experience;
  const priced = e.price != null && e.price > 0;

  return (
    <div className={`mx-auto max-w-6xl px-5 py-10 ${showInquiry ? "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12" : ""}`}>
      <div className="min-w-0">
        {e.body && (
          <div className="eac-article max-w-2xl" data-layout="note">
            <div className="eac-article__body" dangerouslySetInnerHTML={{ __html: e.body }} />
          </div>
        )}
        {showHighlights && e.highlights.length > 0 && (
          <section className="mt-8 max-w-2xl">
            <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Highlights</h2>
            <ul className="mt-2 space-y-1 text-sm">{e.highlights.map((h) => <li key={h}>— {h}</li>)}</ul>
          </section>
        )}
        {showPeople && e.people.length > 0 && (
          <div className="mt-12 max-w-2xl border-t border-border pt-8">
            <PeopleList people={e.people} />
          </div>
        )}
      </div>

      {showInquiry && (
        <aside id="inquire" className="mt-12 lg:mt-0">
          <div className="sticky top-24 border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{inquiryHeading || "Ask about it"}</p>
            <p className="mt-1 font-serif text-2xl">
              {priced ? <>{formatPrice(e.price, e.currency)} <span className="text-base text-muted-foreground">indicative</span></> : "Price on request"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Tell us when you would like to come and how many you are; we arrange the rest by email.
            </p>
            <div className="mt-5">
              <ExperienceInquiry threadId={e.id} title={e.title} signedInEmail={page.signedInEmail} disabled={e.status !== "published"} />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

export interface ExperienceGalleryProps { heading: string }

/** The experience's other pictures. Nothing when it has none beyond the cover. */
export function ExperienceGalleryBlock({ heading }: ExperienceGalleryProps) {
  const page = useExperiencePage();
  if (!page) return null;
  const e = page.experience;
  const images = e.images.filter((u) => u !== e.coverImageUrl);
  if (images.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      {heading && <h2 className="font-serif text-2xl">{heading}</h2>}
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((src) => (
          <li key={src} className="aspect-[4/3] overflow-hidden bg-muted">
            <a href={src} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface ExperienceMoreProps { heading: string; count: number }

/** Other experiences, as cards. */
export function ExperienceMoreBlock({ heading, count }: ExperienceMoreProps) {
  const page = useExperiencePage();
  if (!page || page.others.length === 0 || count <= 0) return null;
  return (
    <section className="mx-auto max-w-6xl border-t border-border px-5 py-14">
      <h2 className="font-serif text-2xl">{heading || "More experiences"}</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {page.others.slice(0, count).map((o) => <ExperienceCard key={o.id} experience={o} />)}
      </div>
    </section>
  );
}

export interface ExperienceTextProps { heading: string; text: string }

/** A heading and a paragraph shown on every experience page (practical notes, a policy line). */
export function ExperienceTextBlock({ heading, text }: ExperienceTextProps) {
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
