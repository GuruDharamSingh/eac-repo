import type { ActionLinks } from "@elkdonis/actions";
import { ARTDIRECT_URL, NETWORK_URL } from "@/lib/site";

/**
 * Where the registry's addresses point from Sophia (2026-11-27). Sophia is not the hub:
 * `hub` is the arts-collective origin, so a step whose control is still only on the hub opens
 * there until it is done in the dock. No `market` key: market addresses use the hub routes here.
 */
export const DOCK_LINKS: ActionLinks = {
  hub: NETWORK_URL,
  artdirect: ARTDIRECT_URL,
  networkHost: process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com",
  nextcloud: (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "") || undefined,
};
