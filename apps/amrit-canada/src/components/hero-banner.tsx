"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The rotating hero from the original site. Slides and captions are the
 * originals; the images are remote URLs the previous version linked directly,
 * kept as-is so nothing visually disappears.
 *
 * Worth replacing with uploaded media eventually — two of the three are
 * hotlinked from sites outside our control and will break when they change.
 */
const SLIDES = [
  {
    src: "https://toronto.citynews.ca/wp-content/blogs.dir/sites/10/2022/11/08/Centennial-Park-in-Etobicoke-1536x712.jpg",
    alt: "Toronto park landscape",
    title: "Amrit Vela - The Ambrosial Hours",
    subtitle: "Rise with the sun and crown yourself in sacred time",
  },
  {
    src: "https://firebasestorage.googleapis.com/v0/b/meetingcardapp.firebasestorage.app/o/admin-uploads%2FjjKnWQw2dJdi0CCA1klGM0xdO6X2%2F1753996032695_Screenshot_2025-07-31_170618.png?alt=media&token=1bf15667-aee3-4eea-95a5-8aa0df97f765",
    alt: "Sacred practice session",
    title: "Sacred Morning Practice",
    subtitle: "Join our community in 2.5 hours of transformation",
  },
  {
    src: "https://youngyogamasters.com/wp-content/uploads/2013/03/Guru-Ram-Das-Ashram-Toronto.jpg",
    alt: "Toronto",
    title: "Toronto Spiritual Community",
    subtitle: "Experience the power of group meditation and kirtan",
  },
];

export function HeroBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, [paused]);

  const go = (delta: number) =>
    setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);

  return (
    <section
      className="relative h-[450px] overflow-hidden bg-[#36454f]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.src} alt={slide.alt} className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#36454f]/90 via-[#36454f]/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-16 text-center">
            <h2
              className="font-serif text-[clamp(2rem,8vw,3.5rem)] leading-tight text-[#f4c430]"
              style={{ textShadow: "2px 2px 12px rgba(0,0,0,0.6)" }}
            >
              {slide.title}
            </h2>
            <p
              className="mt-3 text-[clamp(1rem,4vw,1.4rem)] italic text-[#fdf5e6]"
              style={{ textShadow: "1px 1px 8px rgba(0,0,0,0.6)" }}
            >
              {slide.subtitle}
            </p>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-[#f4c430]/50 bg-black/30 p-2 text-[#f4c430] transition hover:bg-black/50"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-[#f4c430]/50 bg-black/30 p-2 text-[#f4c430] transition hover:bg-black/50"
      >
        <ChevronRight className="size-5" />
      </button>

      <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            className="size-2.5 rounded-full transition"
            style={{
              backgroundColor: i === index ? "#f4c430" : "rgba(253,245,230,0.45)",
            }}
          />
        ))}
      </div>
    </section>
  );
}
