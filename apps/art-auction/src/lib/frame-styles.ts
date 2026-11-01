import { FRAME_STYLES, type FrameStyle } from "@elkdonis/three/hallway";

/**
 * Real frames from the IFAC collection, rebuilt in 3D from photographs and
 * scans (Oct 2026). Each asset is modelled at its true size around its own
 * opening, so the hallway fits it by slicing: corners keep their carving and
 * only the rails lengthen. Sizes were estimated from standard opening sizes.
 *
 * Files live in `public/frames/`: `<id>.glb` and a `<id>.jpg` thumbnail.
 */
const SCANNED_FRAMES: readonly FrameStyle[] = [
  {
    id: "ifac-gilt-bamboo",
    label: "Gilt bamboo",
    border: 0.0254,
    depth: 0.0375,
    colour: "#a87a2c",
    roughness: 0.6,
    modelUrl: "/frames/ifac-gilt-bamboo.glb",
    modelOpening: [0.2784, 0.3571],
    thumbnailUrl: "/frames/ifac-gilt-bamboo.jpg",
  },
  {
    id: "ifac-gold-leaf",
    label: "Gold leaf",
    border: 0.0719,
    depth: 0.0338,
    colour: "#b8923e",
    roughness: 0.6,
    modelUrl: "/frames/ifac-gold-leaf.glb",
    modelOpening: [0.2804, 0.3541],
    thumbnailUrl: "/frames/ifac-gold-leaf.jpg",
  },
  {
    id: "ifac-rococo-gilt",
    label: "Rococo gilt",
    border: 0.0698,
    depth: 0.08,
    colour: "#a8823f",
    roughness: 0.55,
    modelUrl: "/frames/ifac-rococo-gilt.glb",
    modelOpening: [0.5118, 0.4133],
    // a deep frame: the slip steps down to the canvas well behind the carving
    imageRecess: 0.09,
    thumbnailUrl: "/frames/ifac-rococo-gilt.jpg",
  },
  {
    id: "ifac-carved-liner",
    label: "Carved gilt, liner",
    border: 0.0838,
    depth: 0.0445,
    colour: "#5a4527",
    roughness: 0.6,
    modelUrl: "/frames/ifac-carved-liner.glb",
    modelOpening: [0.2997, 0.4115],
    // just below the liner's inner edge
    imageRecess: 0.27,
    thumbnailUrl: "/frames/ifac-carved-liner.jpg",
  },
  {
    id: "ifac-bronze-wave",
    label: "Black & bronze wave",
    border: 0.0559,
    depth: 0.0628,
    colour: "#2a2219",
    roughness: 0.7,
    modelUrl: "/frames/ifac-bronze-wave.glb",
    modelOpening: [0.6492, 0.4517],
    // the carving rolls down onto the canvas, so the piece sits low, at the crease
    imageRecess: 0.2,
    thumbnailUrl: "/frames/ifac-bronze-wave.jpg",
  },
];

/** Every frame on offer in this app: the procedural basics, then the real ones. */
export const ART_FRAME_STYLES: readonly FrameStyle[] = [...FRAME_STYLES, ...SCANNED_FRAMES];
