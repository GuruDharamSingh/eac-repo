/**
 * A single piece on show. Deliberately not `@elkdonis/commerce`'s `Artwork` —
 * this package knows nothing about stores, variants or lots, so any app can
 * mount a room over whatever it has. The consumer maps its own records in and
 * renders its own detail panel over the top.
 */
export interface GalleryPiece {
  id: string;
  title: string;
  /** Served image. Ask for a sized variant (`?w=1024`) where the route supports it. */
  imageUrl: string;
  alt?: string | null;
  artistName?: string | null;

  /**
   * How the piece wants to be shown. Wall work hangs; everything else —
   * jewellery, sculpture, ceramics — stands on a plinth under glass. The
   * caller decides, because "is this wall art" is a question about a medium
   * vocabulary that lives in the consuming app, not here.
   */
  display?: 'wall' | 'plinth';

  /**
   * True size in centimetres, when the artist recorded it. Both are needed to
   * be used; with either missing the piece is sized from its image instead,
   * which gets the proportions right but not the scale.
   */
  heightCm?: number | null;
  widthCm?: number | null;

  /**
   * What to do when the photograph's proportions disagree with the recorded
   * size — a square documentation shot of a canvas twice as tall as it is
   * wide, say. Never resolved by stretching the picture.
   *
   * `contain` (the default) keeps the whole photo and shrinks the piece to the
   * photo's shape — honest about the image, but it understates how big the
   * work really is. `cover` opts into keeping the recorded size and cropping
   * the photo into it, which is only right when the photo shows the whole
   * canvas and merely differs a little in proportion.
   *
   * Defaulting to `contain` is deliberate: a mismatch most often means the
   * photograph is a detail crop, and cropping that again cuts into the work.
   */
  imageFit?: 'cover' | 'contain';

  /**
   * A Gaussian-splat capture of the object, shown on its plinth in place of
   * the photograph. Only meaningful for `display: 'plinth'` — a painting is
   * flat and gains nothing from being captured in three dimensions, where a
   * necklace or a carving is the whole point.
   *
   * The file is served like any other media; see the gallery's notes on what
   * a capture costs to load before putting several in one room.
   */
  splatUrl?: string | null;
}

/** Where a hung piece goes, and the box it must fit inside. */
export interface WallSlot {
  piece: GalleryPiece;
  surfaceId: SurfaceId;
  /** Offset along the surface's own left-to-right axis. */
  localX: number;
  /**
   * World height of the piece's centre. Normally the gallery hang line, but
   * lifted for a work tall enough that centring it would put its bottom edge
   * on the floor.
   */
  centreY: number;
  maxWidth: number;
  maxHeight: number;
}

/** Where a standing piece goes. */
export interface PlinthSlot {
  piece: GalleryPiece;
  position: [number, number, number];
}

export type SurfaceId =
  | 'west'
  | 'east'
  | 'north'
  | 'south'
  | 'centerNorth'
  | 'centerSouth';

/**
 * A hangable face. Pieces are positioned in the surface's local frame, so a
 * `rotationY` that turns the default +Z normal into the room is all a
 * consumer needs to place a group against it.
 */
export interface WallSurface {
  id: SurfaceId;
  /** Centre of the hanging band, in world space. */
  origin: [number, number, number];
  rotationY: number;
  /** Hangable span, corners and edges already deducted. */
  usableWidth: number;
  maxPieceHeight: number;
}

export interface GalleryLayout {
  walls: WallSlot[];
  plinths: PlinthSlot[];
  /** Pieces that arrived with no image, or that no surface had room for. */
  omitted: GalleryPiece[];
}

/** Metres a piece measures on each axis once fitted to its slot. */
export interface FittedSize {
  width: number;
  height: number;
  /**
   * UV scale and offset for the image. Anything other than repeat `[1, 1]`
   * crops the photograph to the piece's recorded shape — the picture is never
   * stretched to fill a footprint it does not match.
   */
  repeat: [number, number];
  offset: [number, number];
  /** The photo's proportions disagree with the recorded size. */
  ratioMismatch: boolean;
}
