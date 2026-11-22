"use client";

import { GalleryFace } from "@elkdonis/cms-ui/hub";
import { Heading, Surface } from "./surface";
import { IMAGES } from "./sample";

// Real: cms-ui's GalleryFace on three generated placeholder pictures (no photographs).
export default function Gallery() {
  return (
    <Surface>
      <div>
        <Heading text="Gallery" />
        <GalleryFace images={IMAGES} title="Gallery" />
      </div>
    </Surface>
  );
}
