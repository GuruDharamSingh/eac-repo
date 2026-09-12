import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Where the components fetch charts from. Each host mounts a route that
 * answers `?t=<ISO>&lat&lon` with `{ chart }` — apps/elastrocal/src/app/api/sky
 * is the reference. A host under a basePath passes its prefixed path.
 */
export const SkyConfig = { endpoint: "/api/sky" };

export function setSkyEndpoint(endpoint: string) {
  SkyConfig.endpoint = endpoint;
}
