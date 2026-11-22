"use client";

import { ForumFace, type SurfaceForum } from "@elkdonis/cms-ui/surface";
import { Heading, Surface } from "./surface";
import { FORUM } from "./sample";

// Real: cms-ui's ForumFace with an invented board (three sections, three topics).
export default function Forum() {
  return (
    <Surface>
      <div>
        <Heading text="Forum" />
        <ForumFace forum={FORUM as unknown as SurfaceForum} href="/forum" />
      </div>
    </Surface>
  );
}
