"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BookPage, CurrentBook } from "@/lib/types";
import { BookLeaf } from "./book-leaf";
import { BookCoverFallback } from "./book-cover-fallback";

export interface HeroImage {
  url: string;
  caption: string | null;
}

interface HeroProps {
  book: CurrentBook | null;
  image: HeroImage | null;
  initialPage?: number | null;
  /** Milliseconds between automatic slides; 0 disables. */
  interval?: number;
}

type Slide = { key: string; label: string };

/**
 * The hero: a modest carousel of features.
 *
 *   1. the page of the book we're on, rendered as paper (interactive)
 *   2. the book — cover left, what it is right, a line of praise
 *   3. a call to host a reading session
 *   4. one image, if one has been given
 *
 * It advances on its own, but STOPS the moment someone touches the paper —
 * turning a page and then having the slide swept away mid-sentence is the one
 * thing a carousel must not do here. Hovering pauses it too.
 */
export function Hero({ book, image, initialPage, interval = 9000 }: HeroProps) {
  const slides: Slide[] = [];
  const pages: BookPage[] = book?.pages ?? [];
  if (book && pages.length > 0) slides.push({ key: "leaf", label: "The page we're on" });
  if (book) slides.push({ key: "book", label: "The book" });
  slides.push({ key: "host", label: "Host a session" });
  if (image) slides.push({ key: "image", label: "From the circle" });

  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false); // reader is interacting
  const [hover, setHover] = useState(false);
  const timer = useRef<number | null>(null);

  const count = slides.length;
  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const step = useCallback((d: number) => goTo(index + d), [goTo, index]);

  useEffect(() => {
    if (interval <= 0 || count < 2 || held || hover) return;
    timer.current = window.setTimeout(() => goTo(index + 1), interval);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [index, interval, count, held, hover, goTo]);

  const hold = () => setHeld(true);

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="hero__label">{slides[index]?.label}</span>

      <div className="hero__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((s, i) => (
          <div
            key={s.key}
            className="hero__slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${s.label}`}
            aria-hidden={i !== index}
          >
            {s.key === "leaf" && book && (
              <BookLeaf title={book.title} pages={pages} initialPage={initialPage} onInteract={hold} />
            )}
            {s.key === "book" && book && <BookSlide book={book} />}
            {s.key === "host" && <HostSlide />}
            {s.key === "image" && image && (
              <div className="imageslide">
                {/* Plain <img>: the src is a same-origin proxy URL of unknown
                    size, and next/image would need a width it cannot know. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.caption ?? ""} />
                {image.caption && <div className="imageslide__caption">{image.caption}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button type="button" className="hero__arrow hero__arrow--prev" onClick={() => { hold(); step(-1); }} aria-label="Previous feature">
            <ChevronLeft size={20} aria-hidden />
          </button>
          <button type="button" className="hero__arrow hero__arrow--next" onClick={() => { hold(); step(1); }} aria-label="Next feature">
            <ChevronRight size={20} aria-hidden />
          </button>
          <div className="hero__dots" role="tablist" aria-label="Choose a feature">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.label}
                className="hero__dot"
                data-active={i === index}
                onClick={() => { hold(); goTo(i); }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BookSlide({ book }: { book: CurrentBook }) {
  const progress =
    book.currentPage && book.totalPages
      ? `Page ${book.currentPage} of ${book.totalPages}`
      : book.currentPage
        ? `Page ${book.currentPage}`
        : null;
  return (
    <div className="bookslide">
      <div className="bookslide__cover">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={book.coverUrl} alt={`Cover of ${book.title}`} />
        ) : (
          <BookCoverFallback title={book.title} author={book.author} />
        )}
      </div>
      <div className="bookslide__body">
        <p className="eyebrow">Reading now</p>
        <h2 className="bookslide__title">{book.title}</h2>
        {book.author && <p className="bookslide__author">{book.author}</p>}
        {book.blurb && <p className="bookslide__blurb">{book.blurb}</p>}
        {book.review && (
          <blockquote className="bookslide__review">
            {book.review}
            {book.reviewSource && <cite>{book.reviewSource}</cite>}
          </blockquote>
        )}
        <div className="bookslide__meta">
          {progress && <span>{progress}</span>}
          {book.edition && <span>{book.edition}</span>}
          <Link href="/books">About this book →</Link>
        </div>
      </div>
    </div>
  );
}

function HostSlide() {
  return (
    <div className="callslide">
      <div>
        <p className="eyebrow" style={{ color: "var(--gold)" }}>Help the circle</p>
        <h2>Host a reading session</h2>
        <p>
          A session needs a room, a reader, and someone to keep the time. Offer
          one — your living room, a library corner, a video call — and we&rsquo;ll
          put it on the calendar and bring the book.
        </p>
        <div className="callslide__actions">
          <Link href="/suggest?kind=host" className="btn btn--gold">Offer to host</Link>
          <Link href="/groups" className="btn">See the groups</Link>
        </div>
      </div>
    </div>
  );
}
