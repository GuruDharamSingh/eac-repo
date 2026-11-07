// ============================================================================
// Copy as HTML / Copy as PNG: clipboard helpers for the right-click menu.
//
// PNG is drawn the browser-only way: the element is cloned with every computed
// style written inline (plus its ::before / ::after text), wrapped in an SVG
// <foreignObject>, loaded as an image and painted on a canvas. A web font is
// not available inside such an image, so the faces the element uses are
// fetched from Google (only the Latin block of the weights used) and embedded
// as data URIs. When a font cannot be fetched the PNG still draws, in the
// fallback face. Returns null where the browser refuses (tainted canvas).
// ============================================================================

import { fontEntry, googleFamilyParam, GOOGLE_CSS } from "@elkdonis/fonts";

/** Put text (and optionally HTML or a PNG) on the clipboard. False when the browser refuses. */
export async function copyToClipboard(parts: { text?: string; html?: string; png?: Blob }): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof ClipboardItem !== "undefined" && (parts.html || parts.png)) {
      const data: Record<string, Blob> = {};
      if (parts.text !== undefined || parts.html) data["text/plain"] = new Blob([parts.text ?? parts.html ?? ""], { type: "text/plain" });
      if (parts.html) data["text/html"] = new Blob([parts.html], { type: "text/html" });
      if (parts.png) data["image/png"] = parts.png;
      await navigator.clipboard.write([new ClipboardItem(data)]);
      return true;
    }
    if (navigator.clipboard && parts.text !== undefined) { await navigator.clipboard.writeText(parts.text); return true; }
  } catch { /* fall through to the old way */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = parts.text ?? parts.html ?? "";
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

const fetchText = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(String(r.status)); return r.text(); };
const toDataUri = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  const b = await r.blob();
  return new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });
};

/** @font-face rules (Latin block, data URIs) for the library faces an element draws with. */
async function embeddedFonts(used: Map<string, { weights: Set<number>; italic: boolean }>): Promise<string> {
  let css = "";
  for (const [family, u] of used) {
    const e = fontEntry(family);
    if (!e || e.source !== "google") continue;
    try {
      const href = `${GOOGLE_CSS}?family=${googleFamilyParam(e, { weights: [...u.weights], italics: u.italic })}&display=swap`;
      const text = await fetchText(href);
      const blocks = [...text.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)].filter((m) => m[1] === "latin");
      for (const m of blocks) {
        let rule = m[2]!;
        const urls = [...rule.matchAll(/url\((https:[^)]+)\)/g)];
        for (const u2 of urls) rule = rule.replace(u2[1]!, await toDataUri(u2[1]!));
        css += rule + "\n";
      }
    } catch { /* this face falls back */ }
  }
  return css;
}

function inlineStyles(src: Element, dst: Element, used: Map<string, { weights: Set<number>; italic: boolean }>) {
  const cs = getComputedStyle(src);
  let css = "";
  for (let i = 0; i < cs.length; i++) { const p = cs[i]!; css += `${p}:${cs.getPropertyValue(p)};`; }
  (dst as HTMLElement).setAttribute("style", css);
  dst.removeAttribute("class");
  for (const a of [...dst.attributes]) if (a.name.startsWith("data-") || a.name === "contenteditable") dst.removeAttribute(a.name);
  const first = cs.fontFamily.split(",")[0]!.trim().replace(/^["']|["']$/g, "");
  if (first && src.textContent) {
    const u = used.get(first) ?? { weights: new Set<number>(), italic: false };
    u.weights.add(Number(cs.fontWeight) || 400);
    if (cs.fontStyle === "italic") u.italic = true;
    used.set(first, u);
  }
  // Children first (the clone's children still line up with the source's) ...
  const srcKids = [...src.children], dstKids = [...dst.children];
  srcKids.forEach((k, i) => { if (dstKids[i]) inlineStyles(k, dstKids[i]!, used); });
  // ... then the text a ::before / ::after draws.
  for (const which of ["::before", "::after"] as const) {
    const ps = getComputedStyle(src, which);
    const c = ps.content;
    if (!c || c === "none" || c === "normal" || c === '""') continue;
    const span = document.createElement("span");
    span.textContent = c.replace(/^["']|["']$/g, "").replace(/\\([0-9a-f]{1,6})\s?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
    let pcss = "";
    for (let i = 0; i < ps.length; i++) { const p = ps[i]!; pcss += `${p}:${ps.getPropertyValue(p)};`; }
    span.setAttribute("style", pcss + "display:inline;");
    if (which === "::before") dst.insertBefore(span, dst.firstChild); else dst.appendChild(span);
  }
}

/** Paint an element (laid out on the page) to a PNG. */
export async function elementToPng(el: HTMLElement, o: { scale?: number; background?: string } = {}): Promise<Blob | null> {
  const w = Math.ceil(el.offsetWidth), h = Math.ceil(el.offsetHeight);
  if (!w || !h) return null;
  const clone = el.cloneNode(true) as HTMLElement;
  const used = new Map<string, { weights: Set<number>; italic: boolean }>();
  inlineStyles(el, clone, used);
  clone.style.margin = "0";
  clone.style.width = w + "px";
  const fonts = await embeddedFonts(used);
  const xhtml = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><style>${fonts}</style></defs><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px">${xhtml}</div></foreignObject></svg>`;
  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("image")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const scale = o.scale ?? 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (o.background) { ctx.fillStyle = o.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob | null>((res) => { try { canvas.toBlob((b) => res(b), "image/png"); } catch { res(null); } });
}
