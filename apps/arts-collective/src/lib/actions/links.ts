import type { ActionLinks } from "@elkdonis/actions";

/**
 * Where the registry points finished things on this host (this host is the hub).
 * One object for the lesson's task boxes (lib/lms/connectors.tsx) and the HTTP
 * routes (./routes.ts), so a status reads the same through either.
 */
export const ACTION_LINKS: ActionLinks = {
  hub: "",
  artdirect: (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, ""),
  networkHost: process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com",
};
