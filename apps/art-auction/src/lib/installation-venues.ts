/**
 * The spaces an installation can be hung in, as the server needs them: ids
 * (stored in `art_installation.hallway`) and names. The 3D venues themselves
 * are client-only — see `venues.ts`.
 */
export const INSTALLATION_VENUES = [
  {
    id: "northwest",
    name: "The long hallway",
    blurb: "A long corridor of slate and green carpet, five turns heading north-west.",
  },
  {
    id: "loft",
    name: "The loft",
    blurb: "An industrial flat with a long white block wall and a gable wall.",
  },
  {
    id: "morning-room",
    name: "The morning room",
    blurb: "A red-velvet Edwardian room. Your work goes into its own gilt frames, 19 of them.",
  },
] as const;

export type InstallationVenueId = (typeof INSTALLATION_VENUES)[number]["id"];

export function isVenueId(id: unknown): id is InstallationVenueId {
  return INSTALLATION_VENUES.some((v) => v.id === id);
}
