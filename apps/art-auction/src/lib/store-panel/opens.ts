/** Every gallery id a set of gallery-grid tiles opens — no db import, safe anywhere. */
export function opensIdsOfGrid(items: Array<{ opens?: string }>): string[] {
  return items.map((i) => i.opens).filter((x): x is string => typeof x === "string" && x.length > 0);
}
