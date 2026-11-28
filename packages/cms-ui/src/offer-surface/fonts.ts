// The Google Fonts request for the six font templates (Para, Gazette, Quiet, Marquee, Ledger, Rite)
// and the mono face: the same families and weights the design packet's canvas loads.
//
// It is a <link>, rendered by OfferSurfaceRoot, and NOT a CSS @import: an @import of a remote URL
// inside a stylesheet that is itself imported (offer.css -> look.css) is dropped from the Next /
// Turbopack CSS chunk without an error, in dev and in a build (verified 2026-11-27: neither the
// preview nor the built development app served it, so only families the host happened to load drew).
// Plain module (no "use client") so a server layout can also read the value.
export const OFFER_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;1,400&family=Big+Shoulders+Display:wght@700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=EB+Garamond:ital,wght@0,400;1,400&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400;1,9..144,600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600&family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Libre+Caslon+Display&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Marcellus&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap";
