// Collect Art FX for the clip template (overlay kind `fx`, templates/fx.tsx):
// fire and lightning made in the auction-stream-fx Remotion project, as 30 fps
// VP9-with-alpha copies in packages/reels/public/reel-fx/. The booth has the
// same files as OGraf graphics (docs/reference/nextcloud.md "Collect Art FX pack").
//
// A new FX = its file in public/reel-fx/ + one line below (`pending` while
// the file is not there yet):
//   overlay     1920x1080 with alpha, plays once for its own length
//   loop        1920x1080 with alpha, seamless; repeats for as long as it is set
//   transition  a track-matte stinger, `matte: 'stacked'`: 1920x2160, the
//               stinger with alpha on top, its matte below (white = the
//               incoming picture), as OBS's "same file, stacked"
// Files load with Remotion's staticFile(): the renderer bundles public/
// (render/render.mjs `publicDir`); the Studio's Player asks the app for
// /reel-fx/<file> (apps/arts-collective/public/reel-fx links here).

export type FxCategory = 'overlay' | 'loop' | 'transition';
export type FxCall = 'bid' | 'once' | 'twice' | 'sold';

export interface FxEntry {
  id: string;
  label: string;
  category: FxCategory;
  /** File name in public/reel-fx/. */
  file: string;
  /** One play (a loop's period), in seconds. */
  seconds: number;
  /** The file has an alpha channel (VP9 yuva420p). */
  alpha: boolean;
  /** Transitions: where the luminance matte is. */
  matte?: 'stacked';
  /** The auctioneer's calls: the item's `sub` line is drawn on this call's timing. */
  call?: FxCall;
  /** Not in public/reel-fx/ yet: hidden from the editor and never drawn. Remove once the file is there. */
  pending?: string;
}

/** Folder under public/ (and the Studio's URL prefix). */
export const FX_DIR = 'reel-fx';
/** The FX frame; other reel formats crop it, centred. */
export const FX_SIZE = { width: 1920, height: 1080 };

export const FX_CATALOG: FxEntry[] = [
  { id: 'thunder-strike', label: 'Thunder strike', category: 'overlay', file: 'O1_ThunderStrike.webm', seconds: 2.6, alpha: true },
  { id: 'flame-surge', label: 'Flame surge', category: 'overlay', file: 'O2_FlameSurge.webm', seconds: 4.0, alpha: true },
  { id: 'call-bid', label: 'New high bid', category: 'overlay', file: 'O3a_NewHighBid.webm', seconds: 2.6, alpha: true, call: 'bid' },
  { id: 'call-once', label: 'Going once', category: 'overlay', file: 'O3b_GoingOnce.webm', seconds: 2.4, alpha: true, call: 'once' },
  { id: 'call-twice', label: 'Going twice', category: 'overlay', file: 'O3c_GoingTwice.webm', seconds: 2.6, alpha: true, call: 'twice' },
  { id: 'call-sold', label: 'Sold', category: 'overlay', file: 'O3d_Sold.webm', seconds: 4.4, alpha: true, call: 'sold' },
  { id: 'ember-drift', label: 'Ember drift', category: 'loop', file: 'L1_EmberDrift_loop.webm', seconds: 10, alpha: true },
  { id: 'heat-frame', label: 'Heat frame', category: 'loop', file: 'L2_HeatFrame_loop.webm', seconds: 8, alpha: true },
  { id: 'burn-through', label: 'Burn through', category: 'transition', file: 'T1_BurnThrough_trackmatte-stacked.webm', seconds: 2.0, alpha: true, matte: 'stacked' },
  { id: 'lightning-cut', label: 'Lightning cut', category: 'transition', file: 'T2_LightningCut_trackmatte-stacked.webm', seconds: 1.4, alpha: true, matte: 'stacked' },
  { id: 'fire-wall', label: 'Fire wall', category: 'transition', file: 'T3_FireWall_trackmatte-stacked.webm', seconds: 1.9, alpha: true, matte: 'stacked' },
  // The Brothers typeface in the wordmark is licensed for personal use only:
  // buy the commercial licence before a reel with it is published.
  { id: 'wordmark', label: 'Elkdonis forge wordmark', category: 'overlay', file: 'W1_ElkdonisForge_alpha.webm', seconds: 7.0, alpha: true },
  { id: 'curtains', label: 'Curtains opening', category: 'overlay', file: 'O4_CurtainsOpening.webm', seconds: 5.6, alpha: true },
  { id: 'ascension', label: 'Ascension (clouds and god-rays)', category: 'overlay', file: 'O6_Ascension_no-lot.webm', seconds: 8.0, alpha: true },
  { id: 'page-turn', label: 'Page turn', category: 'transition', file: 'T4_PageTurn_trackmatte-stacked.webm', seconds: 2.0, alpha: true, matte: 'stacked' },
  { id: 'cloth-droop', label: 'Cloth droop', category: 'transition', file: 'T5_ClothDroop_trackmatte-stacked.webm', seconds: 2.3, alpha: true, matte: 'stacked' },
];

export const FX_CATEGORY_LABEL: Record<FxCategory, string> = { overlay: 'Overlays', loop: 'Loops', transition: 'Transitions' };

/** The FX the editor offers: everything whose file is in place. */
export const fxAvailable = () => FX_CATALOG.filter((e) => !e.pending);

export const fxEntry = (id?: string): FxEntry | undefined => (id ? FX_CATALOG.find((e) => e.id === id && !e.pending) : undefined);

/**
 * The text line under a call's word, as auction-stream-fx draws its `sub`
 * prop (src/fx/BidCall.tsx), in FX frame pixels: `top` of the line box, and
 * the seconds over which it fades in and out.
 */
export const FX_CALL_LINE: Record<FxCall, { top: number; serif: boolean; size: number; spacing: string; color: string; glow: string; fadeIn: [number, number]; fadeOut: [number, number] }> = {
  bid: { top: 892.2, serif: false, size: 40, spacing: '0.22em', color: '#dfe7ff', glow: '0 0 24px rgba(110,140,255,0.8)', fadeIn: [0.35, 0.6], fadeOut: [2.1, 2.35] },
  once: { top: 895, serif: false, size: 40, spacing: '0.22em', color: '#ffe2b3', glow: '0 0 24px rgba(191,48,33,0.9), 0 0 2px #8C1F3A', fadeIn: [0.3, 0.55], fadeOut: [1.6, 1.85] },
  twice: { top: 894.5, serif: false, size: 40, spacing: '0.22em', color: '#ffe2b3', glow: '0 0 24px rgba(191,48,33,0.9), 0 0 2px #8C1F3A', fadeIn: [0.3, 0.55], fadeOut: [1.6, 1.85] },
  sold: { top: 736, serif: true, size: 72, spacing: '0.02em', color: '#ffe2b3', glow: '0 0 24px rgba(191,48,33,0.9), 0 0 2px #8C1F3A', fadeIn: [0.75, 1.1], fadeOut: [3.1, 3.4] },
};

/** Font files for the call line, in public/reel-fx/fonts/ (SIL OFL 1.1). */
export const FX_FONTS = [
  { family: 'CA Fraunces', file: 'fonts/Fraunces-600-latin.woff2' },
  { family: 'CA Inter', file: 'fonts/Inter-600-latin.woff2' },
];
