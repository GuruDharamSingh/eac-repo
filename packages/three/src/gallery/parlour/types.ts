/**
 * Where the parlour's furniture is served from. Passed in by the consuming
 * app, like the pieces themselves: this package ships code, not media, and
 * the files belong wherever that app keeps its static assets.
 *
 * Sofa, armchair and vase are glTF binaries; the coffee table is an OBJ.
 */
export interface ParlourAssets {
  sofaUrl: string;
  armchairUrl: string;
  coffeeTableUrl: string;
  vaseUrl: string;
}
