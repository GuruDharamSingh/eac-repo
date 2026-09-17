/**
 * Values shared by the room designs and by the maths that places work in them.
 * Their own module so a design can describe itself without importing the
 * layout engine that consumes it.
 */

/**
 * Gallery convention hangs a work's centre at about eye level and keeps it
 * there regardless of the work's size, so a wall of mixed pieces reads as one
 * line rather than a jumble.
 */
export const HANG_CENTRE_Y = 1.55;

/**
 * Least a piece's bottom edge may sit above the floor. A work tall enough
 * that the hang line would drop it below this is raised instead, which is
 * what a gallery does with an oversized canvas rather than resting it on the
 * skirting.
 */
export const MIN_FLOOR_CLEARANCE = 0.22;

/** Standing eye height. */
export const EYE_Y = 1.62;

/** How far back the camera stops when it walks you up to a piece. */
export const VIEW_DISTANCE = 1.9;

/** Clearance kept between the camera and any wall. */
export const BODY_RADIUS = 0.55;

/** Lifts a hanging surface off its wall so the two do not z-fight. */
export const SURFACE_EPSILON = 0.03;

/**
 * How far a photograph's proportions may stray from the recorded size before
 * the two are treated as disagreeing. Photographs are rarely cropped to the
 * millimetre, so a couple of percent is not worth acting on.
 */
export const RATIO_TOLERANCE = 0.02;
