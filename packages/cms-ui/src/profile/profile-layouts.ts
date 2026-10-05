/**
 * How a person's profile page can be rendered.
 *
 * `users.profile_layout` holds one of these ids. 'standard' is the React page
 * (PersonPage, frame look); every other id names a template directory under
 * packages/silex-nextcloud-connector/src/templates.
 *
 * Kept as a short explicit list rather than reading the manifest directory at
 * runtime: only some templates describe a PERSON. `workshop` and `enneagram`
 * are real templates and would be nonsense here, so the set of layouts a
 * profile may choose is a smaller, curated thing than the set that exists.
 *
 * Shared rather than app-local because a person's chosen layout has to mean
 * the same thing wherever their profile is rendered — ArtDirect today,
 * arts-collective once the directory is folded in.
 */
export interface ProfileLayoutOption {
  id: string;
  label: string;
  description: string;
}

export const PROFILE_LAYOUTS: ProfileLayoutOption[] = [
  {
    id: "standard",
    label: "Standard page",
    description:
      "The framed artist page: portrait and statement beside your work, then what you've published. Takes your frame colour.",
  },
  {
    id: "dossier",
    label: "Classified dossier",
    description:
      "The archive look — typewriter headings, stamps, redaction. Strong character, less conventional.",
  },
];

/** The default since 2026-09-26 (migration 168); was "dossier". */
export const DEFAULT_PROFILE_LAYOUT = "standard";

export function isKnownLayout(value: string | null | undefined): boolean {
  return PROFILE_LAYOUTS.some((l) => l.id === value);
}

/** Falls back rather than throwing — an unknown value must not 500 a page. */
export function resolveLayout(value: string | null | undefined): string {
  return isKnownLayout(value) ? (value as string) : DEFAULT_PROFILE_LAYOUT;
}
