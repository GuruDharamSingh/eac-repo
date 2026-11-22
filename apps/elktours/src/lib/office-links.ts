/**
 * Deep links into the hub's Office band (2026-11-21). `/hub?office=<key>[&tour=<id>][&step=route|details]` opens
 * that card's popup over the hub on arrival (components/hub/HubSurfaces.tsx, `OfficeDeepLink`). Custom surface
 * descriptors are not URL-addressable in cms-ui, so the hub reads this site-local query instead.
 */
export type OfficeKey = "create-tour" | "schedule" | "add-place" | "availability" | "takes";
export type OfficeStep = "description" | "route" | "details";

export const OFFICE_PARAM = "office";

export function officeHref(key: OfficeKey, opts: { tourId?: string; step?: OfficeStep } = {}): string {
  const q = new URLSearchParams({ [OFFICE_PARAM]: key });
  if (opts.tourId) q.set("tour", opts.tourId);
  if (opts.step) q.set("step", opts.step);
  return `/hub?${q.toString()}`;
}

const STEP_NUMBER: Record<OfficeStep, 1 | 2 | 3> = { description: 1, route: 2, details: 3 };
export const stepNumber = (s: string | null | undefined): 1 | 2 | 3 => STEP_NUMBER[s as OfficeStep] ?? 1;
