// The real shade maker, imported by relative path (as src/lib/sites-door.ts does for house-editor):
// packages/gradients/src/ramps.ts (roleRamp, onColor, RAMP_STEPS) and color.ts (contrast, normHex, luminance).
// The page therefore shows the very shades the real tool makes. Once @elkdonis/gradients is a dependency of this
// app, change these two lines to import from the package name.
export { roleRamp, onColor, RAMP_STEPS } from "../../../../../packages/gradients/src/ramps";
export { contrast, normHex, luminance } from "../../../../../packages/gradients/src/color";
