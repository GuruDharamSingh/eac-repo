// Where a picked or uploaded file is going (lib/media-picker.ts decides link or copy from it). Types only: the picker
// field (client) and the server share this shape.

export type MediaDestination =
  | { kind: "tour"; tourId: string; slot: "cover" | "gallery" | "stop"; stopId?: string | null }
  | { kind: "place"; placeId: string }
  | { kind: "general"; context?: string | null };
