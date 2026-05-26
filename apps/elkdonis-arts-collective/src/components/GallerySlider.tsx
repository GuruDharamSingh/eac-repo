"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const slides = [
  "/GreenTaraStatue_254836ac-8264-415a-8b96-f0743ec616d7-2-edited-1-scaled.jpg",
  "/IMG-20250719-WA0001-1.jpg",
  "/danamccool.jpg",
  "/fnordbalance-1.jpg",
  "/GD-Full-for-Lotus-edited.jpg",
  "/steph-1.jpg",
];

export function GallerySlider() {
  const [index, setIndex] = useState(0);

  function goTo(nextIndex: number) {
    setIndex((nextIndex + slides.length) % slides.length);
  }

  return (
    <section id="gallery" className="gallery-section" aria-label="Gallery">
      <div className="section-inner gallery-inner">
        <div className="gallery-frame">
          <div
            className="gallery-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((src, slideIndex) => (
              <div className="gallery-slide" key={src}>
                <Image
                  src={src}
                  alt={`Gallery image ${slideIndex + 1}`}
                  fill
                  sizes="(max-width: 900px) 100vw, 900px"
                  priority={slideIndex === 0}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            className="gallery-control gallery-control-prev"
            onClick={() => goTo(index - 1)}
            aria-label="Previous image"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="gallery-control gallery-control-next"
            onClick={() => goTo(index + 1)}
            aria-label="Next image"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="gallery-dots" aria-label="Gallery image selection">
          {slides.map((src, slideIndex) => (
            <button
              type="button"
              key={src}
              className={`gallery-dot ${slideIndex === index ? "is-active" : ""}`}
              onClick={() => goTo(slideIndex)}
              aria-label={`Show image ${slideIndex + 1}`}
              aria-current={slideIndex === index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}