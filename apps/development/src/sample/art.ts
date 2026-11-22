// Generated placeholder pictures for the shared sample world: no photographs, no files, no real faces.
// Every function returns a data URI (an inline SVG), so a block can use it wherever it expects an image URL.

const uri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A soft landscape-like picture from one hue (0-359): a two-tone wash, a sun disc, a low hill, an optional caption. */
export function picture(hue: number, label = "", w = 800, h = 600): string {
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},34%,46%)"/><stop offset="1" stop-color="hsl(${(hue + 38) % 360},30%,26%)"/></linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/>` +
      `<circle cx="${w * 0.72}" cy="${h * 0.3}" r="${h * 0.11}" fill="hsl(${hue},55%,82%)" opacity=".5"/>` +
      `<path d="M0 ${h * 0.78} Q ${w * 0.3} ${h * 0.56} ${w * 0.55} ${h * 0.74} T ${w} ${h * 0.64} V ${h} H0Z" fill="hsl(${hue},28%,16%)" opacity=".62"/>` +
      (label ? `<text x="${w * 0.05}" y="${h * 0.93}" font-family="Georgia,serif" font-size="${Math.round(h * 0.06)}" fill="#fff" opacity=".78">${esc(label)}</text>` : "") +
      `</svg>`,
  );
}

/** A flat abstract "painting" for artworks: layered colour fields, never a likeness of anything. */
export function artwork(hue: number, seed = 0, w = 800, h = 1000): string {
  const a = (hue + seed * 23) % 360;
  const b = (hue + 140 + seed * 11) % 360;
  const c = (hue + 250) % 360;
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="100%" height="100%" fill="hsl(${a},30%,88%)"/>` +
      `<rect x="${w * 0.1}" y="${h * 0.12}" width="${w * 0.8}" height="${h * 0.46}" fill="hsl(${a},46%,48%)"/>` +
      `<rect x="${w * 0.1}" y="${h * 0.58}" width="${w * 0.8}" height="${h * 0.2}" fill="hsl(${b},40%,38%)"/>` +
      `<circle cx="${w * (0.3 + (seed % 3) * 0.2)}" cy="${h * 0.38}" r="${w * 0.12}" fill="hsl(${c},50%,80%)" opacity=".8"/>` +
      `<rect x="${w * 0.1}" y="${h * 0.84}" width="${w * 0.5}" height="${h * 0.012}" fill="hsl(${a},20%,30%)" opacity=".5"/>` +
      `</svg>`,
  );
}

/** A person's placeholder: initials on a gradient disc. Not a face, not a photograph. */
export function avatar(name: string, hue: number, size = 400): string {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return uri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},38%,48%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},34%,28%)"/></linearGradient></defs>` +
      `<rect width="100" height="100" fill="url(#g)"/>` +
      `<text x="50" y="58" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#fff" opacity=".85">${esc(initials)}</text>` +
      `</svg>`,
  );
}
