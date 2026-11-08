// ============================================================================
// The Hidden Enneagram's sound engine, app-local and kept extractable: nothing
// under src/lib/sound imports from the app (only tone, tonal, xen-dev-utils,
// pitchy and React for react.ts). Lift the folder into packages/ when a second
// site wants it.
//
//   tuning.ts   the nine points as pitches: Ouspensky's octave (default),
//               shocks as passing tones, harmonic series 9-18; cents, landing
//   rhythm.ts   the hexad and its six rotations, the walked octave, the
//               triangle; nine-pulse Euclidean rhythms
//   engine.ts   unlock() in the gesture, ready() loads Tone; voices, shocks,
//               drone, lens feel, volume (browser only)
//   pitch.ts    the microphone and pitchy (browser only, nothing recorded)
//   store.ts    visitor prefs, site defaults, the duck bus for the music player
//   react.ts    useSoundState()
//
// Licences: tone, tonal, xen-dev-utils, pitchy are MIT. No GPL/AGPL/LGPL code
// (the repo is public); see docs/audio-research.md 4.
// ============================================================================

export * from "./tuning";
export * from "./rhythm";
export * from "./store";
