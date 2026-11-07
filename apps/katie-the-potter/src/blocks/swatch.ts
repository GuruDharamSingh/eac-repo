// Glaze Lab: a click on one of a card's swatches (its OWN pictures) pours that
// picture over the current one. Plain DOM, called by whichever client island
// owns the card's clicks (the grid, or a Piece's PopupHost). Returns true when
// it handled the click. Reduced motion: the picture swaps at once.

import { sized, srcSet } from "./media";

export function pourSwatch(target: EventTarget | null): boolean {
  const btn = (target as HTMLElement | null)?.closest?.<HTMLButtonElement>("button[data-swatch]");
  if (!btn) return false;
  const card = btn.closest(".ktp-card");
  const pic = card?.querySelector<HTMLElement>(".ktp-card-pic");
  const img = pic?.querySelector<HTMLImageElement>(".ktp-card-img");
  const url = btn.dataset.swatch ?? "";
  if (!card || !pic || !img || !url) return true;

  for (const b of card.querySelectorAll<HTMLButtonElement>("button[data-swatch]")) b.setAttribute("aria-pressed", String(b === btn));
  const doc = img.ownerDocument;
  const reduce = doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const swap = () => {
    img.src = sized(url, 512);
    const set = srcSet(url);
    if (set) img.srcset = set;
    else img.removeAttribute("srcset");
    img.alt = btn.dataset.alt ?? img.alt;
    pic.style.setProperty("--ktp-pic-src", `url("${sized(url, 512).replace(/["\\\n]/g, "")}")`);
  };
  if (reduce) {
    swap();
    return true;
  }
  // The new glaze runs down over the old: a copy on top, unclipped from the rim down.
  pic.querySelector(".ktp-card-pour")?.remove();
  const pour = doc.createElement("img");
  pour.className = "ktp-card-img ktp-card-pour";
  pour.alt = "";
  pour.src = sized(url, 512);
  pic.appendChild(pour);
  pour.addEventListener("animationend", () => {
    swap();
    pour.remove();
  }, { once: true });
  return true;
}
