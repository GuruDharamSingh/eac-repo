// ============================================================================
// @elkdonis/hub: the hub card contract (pass 0, 2026-11-08).
// Plan: docs/open/hub-cards-handoff/PLAN.md §1. Architect: NETWORK_SERVING_ARCHITECTURE §4.2.
//
// Types and two identity helpers only. No data access, no next/*, no route.
//
// A card has two halves with the same id, because one object cannot carry both
// a db-touching loader and client components across Next's boundary:
//   defineHubCard        client-safe: words, gates, Face / Popup / Detail
//   defineHubCardServer  server-only: load (face + pop-up) and loadDetail
//
// Every host (a custom app today through real files, the org-site kit later,
// the shell under /sites/[slug]) passes the same `site` and `viewer` and its
// own HubCardHost. Nothing in a card imports app config.
// ============================================================================

import type * as React from 'react';
import type { CommonIconName, HostLinks, IconMap } from '@elkdonis/utils/host';
import type { SiteBuilderDeclaration } from './site-builder/model';

/** The same four roles as services/org-membership.ts OrgRole. Kept local so the UI needs no services import. */
export type HubRole = 'owner' | 'guide' | 'member' | 'viewer';

export type HubGate = 'public' | 'signed-in' | 'member' | 'guide' | 'owner';

/**
 * From defineSite (custom app) or loadSiteContext (shell). The kit rule: cards take `site`, never app config.
 * Must stay a SUBSET of the kit's SiteDefinition (packages/org-site, phase 0 from 11-09): one site type,
 * not two. Plain data only (it crosses into the kit and, in the shell, comes from the DB).
 */
export interface HubSite {
  orgId: string;
  name: string;
  /** Initials or a short mark for the hub top bar. */
  mark: string;
  /** "ifacgroup.com": shown in sublines and the New page address. */
  domain: string;
  /** "https://ifacgroup.com". */
  baseUrl: string;
  /** "" or a Next basePath such as fourthway's "/books" (it has no org_domains row). Every href respects it. */
  basePath: string;
  timeZone: string;
  /** The ceiling. Runtime on/off: hub/server capabilityOn() = features ∧ org_grants ∧ org_capabilities (later). */
  features: Record<string, boolean>;
  /** Site Builder's per-site declaration (template pages and copy slots, look). Serializable; exported from the app's site.ts. */
  siteBuilder?: SiteBuilderDeclaration;
}

export interface HubViewer {
  userId: string;
  name: string;
  /** null = signed in but not in the org. */
  role: HubRole | null;
  isNetworkAdmin: boolean;
}

export interface HubSectionGate {
  gate?: HubGate;
  /** A capability key (org_capabilities later; 'nextcloud_access' = org_grants today). */
  capability?: string;
}

/**
 * Icon names cards ask for; the host maps them onto its library (Lucide in the spec).
 * Shared names come from @elkdonis/utils/host CommonIconName (close, plus, check, list, image, spinner,
 * external, back, person, members…); the rest are the cards' own.
 */
export type HubIconName =
  | CommonIconName
  | 'panels-top-left' | 'square-pen' | 'search' | 'layout-grid' | 'chevron-right' | 'sticky-note'
  | 'bookmark' | 'info' | 'file' | 'users' | 'user-plus' | 'user-minus' | 'lock' | 'cloud';

export type HubIconComponent = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
export type HubIconMap = IconMap<HubIconName, HubIconComponent>;

/** Where the card is drawn right now. The card owns this state machine. */
export type HubCardView = 'card' | 'popup' | 'detail';

export interface HubNav {
  view: HubCardView;
  tab: string | null;
  openPopup(): void;
  close(): void;
  /** Pop-up "Open page ↗", tab links. In-host this is /hub/<id>?tab=. */
  openDetail(tab?: string, row?: string): void;
}

/** Result of a card write (registry entry). Mirrors performAction's shape loosely. */
export type HubActionResult<T = unknown> = { ok: true; value?: T } | { ok: false; error: string };

/**
 * Everything that differs between hosts, on the client. Extends the shared
 * HostLinks (@elkdonis/utils/host), as the forms' FormHost does. Functions only
 * where they must be; declarations (template pages) live on `site`.
 */
export interface HubCardHost extends HostLinks {
  /** /hub/<card>?tab=&row= on this host (basePath included). */
  hubHref(card: string, tab?: string, row?: string): string;
  /** The live site page for a path ('' = home), basePath included. */
  liveHref(path: string): string;
  /** The Puck editor for a page path (sunjay /studio/<slug>). Null when the host has no editor. */
  puckEditHref?(path: string): string | null;
  /** The theme editor, optionally opened on one page's exception (ifac AppearanceCard). */
  themeEditorHref?(pageKey?: string): string | null;
  /**
   * Run a registry entry. The HOST picks the door: a 3-line `'use server'` action
   * (`performHubAction(site, id, input)`, via 'app') now, the kit later. A card can't
   * be pointed at another origin, and member writes never reach the http/mcp doors.
   */
  act<T = unknown>(actionId: string, input: Record<string, unknown>): Promise<HubActionResult<T>>;
  /** Image upload for copy slots and the identity mark; resolves to a stored URL. */
  uploadImage?(file: File, purpose: 'slot' | 'mark'): Promise<HubActionResult<{ url: string; name: string }>>;
  /** Push a URL (Next router on a host; a no-op in the harness). */
  navigate?(href: string): void;
  /** After a write: refresh server data (router.refresh on a host). */
  refresh?(): void;
  icons: HubIconMap;
}

export interface HubCardProps<D, H extends HubCardHost = HubCardHost> {
  data: D;
  host: H;
  nav: HubNav;
}

export interface HubCardDef<FaceData = unknown, DetailData = unknown, H extends HubCardHost = HubCardHost> {
  /** Stable; also the /hub/<id> route. */
  id: string;
  title: string;
  icon: HubIconName;
  /** null = always on. */
  capability: string | null;
  gate: HubGate;
  sections?: Record<string, HubSectionGate>;
  /** Registry ids the card may call: the site-bound door's allow-list. check:registry asserts each exists. */
  actions: readonly string[];
  /**
   * Old URLs this card replaces, as logical /manage screens → card tab. The host's
   * redirect list (and the kit's) is generated from these, not hand-kept. Paths are
   * per app, so they come through HostLinks.manageHref(screen).
   */
  retires: ReadonlyArray<{ screen: string; tab: string | null }>;
  Face: React.ComponentType<HubCardProps<FaceData, H>>;
  Popup: React.ComponentType<HubCardProps<FaceData, H>>;
  Detail: React.ComponentType<HubCardProps<DetailData, H>>;
  /** Set for Channel/Studio-backed cards: Open = an SSO hop. */
  central?: { href(site: HubSite): string };
}

export interface HubCardServerDef<FaceData = unknown, DetailData = unknown> {
  id: string;
  /** Face + pop-up data. Computes `can` on the server; the UI never re-derives a gate. */
  load(site: HubSite, viewer: HubViewer): Promise<FaceData>;
  loadDetail(site: HubSite, viewer: HubViewer, tab: string | null): Promise<DetailData>;
}

export function defineHubCard<F, D, H extends HubCardHost = HubCardHost>(def: HubCardDef<F, D, H>): HubCardDef<F, D, H> {
  return def;
}

export function defineHubCardServer<F, D>(def: HubCardServerDef<F, D>): HubCardServerDef<F, D> {
  return def;
}
