import type { AppMocks } from "../types";

const STATIC = "Static copy of the block markup and classes, the app CSS scoped under [data-mock-app]; sample text invented.";

export const MOCKS: AppMocks = {
  "he-course": { kind: "static", load: () => import("./course"), note: STATIC + " Module list is a sample." },
  "he-hero": { kind: "static", load: () => import("./hero"), note: STATIC + " The ornament is the real AeonSigil component." },
  "he-sigil": { kind: "real", load: () => import("./sigil"), note: "The real AeonSigil component of the app (pure SVG), imported by relative path." },
  "he-type": { kind: "static", load: () => import("./type"), note: STATIC + " Two chapters, the first open." },
  "he-contact": { kind: "static", load: () => import("./contact"), note: STATIC + " The form does not send." },
  "he-forum": { kind: "static", load: () => import("./forum"), note: STATIC + " Topics invented." },
  "he-person": { kind: "static", load: () => import("./person"), note: STATIC + " Card shape, an invented person, a glow in place of a photo." },
  "he-service": { kind: "static", load: () => import("./service"), note: STATIC + " An invented service with a sliding-scale price; the button does nothing." },
  "he-enneagram": { kind: "static", load: () => import("./enneagram"), note: STATIC + " Geometry and type text come from the real content and geometry modules; no sound, no state." },
  "he-reading": { kind: "static", load: () => import("./reading"), note: STATIC + " Uses the real Wheel component; steps invented." },
  "he-music-web": { kind: "static", load: () => import("./music-web"), note: STATIC + " A still of the ring; sound and microphone are not mocked." },
};
