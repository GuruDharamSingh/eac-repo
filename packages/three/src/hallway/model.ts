/**
 * `@elkdonis/three/hallway/model`: the hallway's plain data vocabulary, with no
 * React or three in it, built without the package's `'use client'` banner so
 * server code (an app's server actions) can import it to bound what an editor
 * sends. The client entry, `@elkdonis/three/hallway`, exports the same names.
 */
export {
  FRAME_RATIOS,
  DEFAULT_CROP,
  ZOOM_MAX,
  ratioNumber,
  isFrameRatio,
  type FrameRatio,
  type Crop,
} from './framing';
export {
  DEFAULT_LIGHTING,
  DEFAULT_LAMP,
  KEY_FROM,
  LAMP_POINTS,
  LIGHT_PRESETS,
  LIGHTING_BOUNDS,
  isLampAt,
  normalizeLamp,
  normalizeLighting,
  presetOf,
  type KeyFrom,
  type LampAt,
  type LampSettings,
  type LightPresetId,
  type PieceLamp,
  type SceneLighting,
} from './lighting';
export {
  OPEN_SPOT_ID,
  normalizeOpenSpot,
  normalizeScene,
  normalizeView,
  type OpenSpot,
  type Scene,
  type SceneSettings,
  type SceneView,
  type SceneViewMode,
} from './scene';
