import {
  HALLWAY_VENUE,
  createLoftVenue,
  createMorningRoomVenue,
  type Venue,
} from "@elkdonis/three/hallway";

/**
 * The 3D spaces, by the id an installation stores. The loft's model is served
 * from this app's public folder; see public/rooms/CREDITS.txt.
 */
const VENUES: Record<string, Venue> = {
  northwest: HALLWAY_VENUE,
  loft: createLoftVenue("/rooms/big_room.glb"),
  "morning-room": createMorningRoomVenue("/rooms/morning_room.glb"),
};

export function venueFor(id: string | null | undefined): Venue {
  return (id && VENUES[id]) || HALLWAY_VENUE;
}
