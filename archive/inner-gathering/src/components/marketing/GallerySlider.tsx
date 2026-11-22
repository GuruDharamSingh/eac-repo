"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

function normalizeMediaPath(path?: string) {
  if (!path) return "";
  const trimmed = path.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  const idx = trimmed.indexOf("EAC_Network/");
  return idx >= 0 ? trimmed.slice(idx) : trimmed;
}

function buildImageSrc(path: unknown): string | null {
  if (typeof path !== "string") return null;
  const input = path.trim();
  if (!input) return null;
  if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("/")) {
    return input;
  }
  const normalized = normalizeMediaPath(input);
  if (!normalized) return null;
  return `/api/media/file?path=${encodeURIComponent(normalized)}`;
}

export function GallerySlider() {
  const [slides, setSlides] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/admin/site-config?key=image_spaces")
      .then((r) => r.json())
      .then((data) => {
        const images = data?.value?.gallery?.images;
        if (Array.isArray(images) && images.length > 0) {
          const normalized = images
            .map((img: unknown) => buildImageSrc(img))
            .filter((src): src is string => Boolean(src));
          setSlides(normalized);
          setIndex(0);
        }
      })
      .catch(() => {});
  }, []);

  // Nothing to show until an admin configures gallery images
  if (slides.length === 0) return null;

  const safeSlides = slides;

  function goTo(nextIndex: number) {
    setIndex((nextIndex + safeSlides.length) % safeSlides.length);
  }

  return (
    <section id="gallery" className="gallery-section" aria-label="Gallery">
      <div className="section-inner gallery-inner">
        <div className="gallery-frame">
          <div
            className="gallery-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {safeSlides.map((src, slideIndex) => (
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
          {safeSlides.map((src, slideIndex) => (
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