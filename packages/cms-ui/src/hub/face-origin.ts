/**
 * The face an element sits inside.
 *
 * A hub face opens some of its surfaces from its own live regions — a day on
 * the calendar, a thumbnail in the gallery, an option in the compose picker —
 * rather than from the card's hit area. Those handlers still want the surface
 * to grow out of the face rather than appear from nowhere, so they pass this.
 * See the morph in surface.css.
 */
export function faceOf(el: Element | null | undefined): HTMLElement | null {
  return el?.closest<HTMLElement>(".eac-face") ?? null;
}
