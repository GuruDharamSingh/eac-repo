"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  alt?: string | null;
}

export function ArtworkGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const list = images.length > 0 ? images : [{ url: "", alt: title }];
  const current = list[Math.min(active, list.length - 1)]!;

  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        {current.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.alt ?? title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
      </div>
      {list.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {list.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "h-16 w-16 overflow-hidden rounded-md border-2 transition-colors",
                i === active ? "border-primary" : "border-transparent hover:border-border"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt ?? `${title} view ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
