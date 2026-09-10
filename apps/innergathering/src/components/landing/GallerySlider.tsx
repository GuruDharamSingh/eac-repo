"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** The admin-configured gallery, as it was: one frame, arrows, dots. Renders nothing without images. */
export function GallerySlider({ slides }: { slides: string[] }) {
  const [index, setIndex] = useState(0);
  if (slides.length === 0) return null;
  const go = (n: number) => setIndex((n + slides.length) % slides.length);

  return (
    <section id="gallery" className="gallery-section" aria-label="Gallery">
      <div className="section-inner gallery-inner">
        <div className="gallery-frame">
          <div className="gallery-track" style={{ transform: `translateX(-${index * 100}%)` }}>
            {slides.map((src, i) => (
              <div key={`${src}-${i}`} className="gallery-slide" aria-hidden={i !== index}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading={i === 0 ? "eager" : "lazy"} />
              </div>
            ))}
          </div>
          {slides.length > 1 && (
            <>
              <button type="button" className="gallery-control gallery-control-prev" onClick={() => go(index - 1)} aria-label="Previous image">
                <ChevronLeft size={22} />
              </button>
              <button type="button" className="gallery-control gallery-control-next" onClick={() => go(index + 1)} aria-label="Next image">
                <ChevronRight size={22} />
              </button>
              <div className="gallery-dots">
                {slides.map((_, i) => (
                  <button key={i} type="button" className={`gallery-dot${i === index ? " is-active" : ""}`} onClick={() => go(i)} aria-label={`Image ${i + 1}`} aria-current={i === index} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
