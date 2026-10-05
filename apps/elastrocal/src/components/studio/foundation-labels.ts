/** Plain-English names for the Foundations pages (shared by server and client components). */

export const MODE_LABEL: Record<string, string> = {
  general: "General teaching",
  natal: "Birth chart",
  transit: "Transit",
  progression: "Progression",
  synastry: "Two charts compared",
  other: "Other",
};

export const ROLE_LABEL: Record<string, string> = {
  describes_element: "Describes the element itself",
  sign_through_element: "Describes a sign through its element",
  placement: "A planet or point placed in it",
  balance: "Too much or too little of it",
  between_elements: "Compares it with another element",
  passing: "Only mentions it in passing",
  figurative: "A figure of speech",
};

export const FACET_HEADING: Record<string, string> = {
  itself: "In itself",
  dominant: "When a chart has a lot of it",
  lacking: "When a chart has little or none of it",
};

export const TERM_FACET_LABEL: Record<string, string> = { itself: "", lacking: "when a chart has little or none", dominant: "when a chart has a lot" };

export const GROUP_LABEL: Record<string, string> = {
  element: "Elements",
  mode: "Modes",
  polarity: "Polarity",
  element_balance: "Balance of the elements",
  mode_balance: "Balance of the modes",
  hemisphere: "Hemispheres",
  quadrant: "Quadrants",
  planetary_pattern: "Planetary patterns",
  aspect_configuration: "Aspect configurations",
  aspect: "Aspects",
  planet: "Planets",
  sign: "Signs",
  house: "Houses",
  house_type: "House types",
  rulership: "Rulership",
  planet_condition: "Condition of a planet",
  node: "Nodes",
  angle: "Angles",
  method: "Method",
  other: "Other",
};

/** What one concept of a lesson is called in a sentence ("Not the element"). */
/** The heading over the "dominant" and "lacking" subsections ("Balance of the elements"). */
export const BALANCE_HEADING: Record<string, string> = { element: "Balance of the elements", modality: "Balance of the modes", polarity: "Balance of the polarities" };

export const LESSON_NOUN: Record<string, string> = { elements: "element", modes: "mode", planets: "planet", signs: "sign", houses: "house" };

export const label = (map: Record<string, string>, key: string | null | undefined): string =>
  key ? (map[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ")) : "Not said";

export const SUBJECT_TYPE_LABEL: Record<string, string> = {
  sign: "Signs",
  planet: "Planets",
  house: "Houses",
  point: "Points",
  element: "Elements",
  modality: "Modes",
  polarity: "Polarity",
  aspect: "Aspects",
  aspect_configuration: "Aspect configurations",
  planetary_pattern: "Planetary patterns",
  planet_condition: "Condition of a planet",
  house_type: "House types",
  rulership: "Rulership",
  hemisphere: "Hemispheres",
};
export const CORR_FACET_LABEL = FACET_HEADING;
export const RULING_LABEL: Record<string, string> = { useful: "Useful for readings", lore: "Lore only", drop: "Dropped" };
