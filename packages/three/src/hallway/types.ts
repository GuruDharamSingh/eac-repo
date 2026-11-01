/**
 * A work that can hang in the hallway. Like the gallery's `GalleryPiece`, this
 * knows nothing of stores or prices; the consuming app maps its records in.
 */
export interface HallwayPiece {
  id: string;
  title: string;
  /** Served image. Ask for a sized variant (`?w=1024`) where the route supports it. */
  imageUrl: string;
  artistName?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  /**
   * Image width over height, when the app already knows it — used to size a
   * piece before its texture has loaded, so a drop is outlined at the right
   * shape. Measured from the tray thumbnail otherwise.
   */
  aspect?: number | null;
}
