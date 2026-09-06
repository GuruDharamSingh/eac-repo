/**
 * How a person's ArtDirect page can be rendered.
 *
 * `users.profile_layout` holds one of these ids. 'standard' is reserved for
 * the React page; every other id names a template directory under
 * packages/silex-nextcloud-connector/src/templates.
 *
 * Kept as a short explicit list rather than reading the manifest directory at
 * runtime: only some templates describe a PERSON. `workshop` and `enneagram`
 * are real templates and would be nonsense here, so the set of layouts a
 * profile may choose is a smaller, curated thing than the set that exists.
 */
export interface ProfileLayoutOption {
  id: string;
  label: string;
  description: string;
}

export const PROFILE_LAYOUTS: ProfileLayoutOption[] = [
  {
    id: "dossier",
    label: "Classified dossier",
    description:
      "The archive look — typewriter headings, stamps, redaction. Strong character, less conventional.",
  },
  {
    id: "standard",
    label: "Standard page",
    description:
      "A plain, readable profile: portrait, statement, work, and what you've published. Inherits your chosen colours.",
  },
];

export const DEFAULT_PROFILE_LAYOUT = "dossier";

export function isKnownLayout(value: string | null | undefined): boolean {
  return PROFILE_LAYOUTS.some((l) => l.id === value);
}

/** Falls back rather than throwing — an unknown value must not 500 a page. */
export function resolveLayout(value: string | null | undefined): string {
  return isKnownLayout(value) ? (value as string) : DEFAULT_PROFILE_LAYOUT;
}
