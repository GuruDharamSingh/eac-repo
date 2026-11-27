# Theme page (idea "five-colour-theme"), 2026-11-22

Files: apps/development/src/ideas/five-colour-theme.tsx; apps/development/src/ideas/five-colour-theme/{FiveColourTheme.tsx, data.ts, theme.ts, gradients.ts, five-colour-theme.css}; one import and one front entry in ideas/index.ts.

- Shades: imported by relative path from packages/gradients/src (ramps.ts roleRamp/onColor, color.ts contrast/normHex/luminance) via gradients.ts, as sites-door.ts does. tsc type-checks and esbuild bundles it. Same shades as the real tool.
- tsc (apps/development, in a one-off eac-dev container): 0 errors.
- Seen on a harness (esbuild bundle + headless Chromium), NOT a signed-in dev copy: the page is a pure client component and the admin gate is outside it. Driver: 50 pass, 0 fail, zero console errors (site switch, palette edit by text and picker, role pointer, tones, live checks, pins, Notes switch, Amrit fifth slot, reload keeps choices, Back to the proposal, Copy, storage blocked, no horizontal scroll and 40px controls at 390 and 1440).
- Screenshots: eris ~/scratch/manjushri/theme/ ; local scratchpad\manjushri\theme\.
- Fonts: the dev app already loads Brothers, Basteleur (local faces) and Cinzel, Lora (Google). Elkdonis specimen: Brothers title, Basteleur body; Amrit: Cinzel, Lora.
- Decisions made: a "as chosen" shade (the colour itself) added beside shades 100 to 900, so ground = pure White and accent = Fire seed work; panel = ground one shade down; soft = Space 300 (elkdonis); line = Water 200; danger = Fire 800 (elkdonis), a fixed red #b3261e outside the palette (Amrit, sixth choice in every colour list); deep tone = ink colour 900 as ground, ground as ink, muted = ground colour 300; accent tone = accent ground, on-accent ink, accent trio and line all drawn in on-accent; starting tones chosen to show all four.
- Finding: with Fire as accent, on-accent on accent is 4.33 (fails 4.5 for text; passes large). Amrit burnt orange 4.41, also just short.
- Not done: signed-in dev copy; Venture face unused; no live deploy.
