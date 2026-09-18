import { networkHrefs, configureForumMedia } from "@elkdonis/forum-ui";

const trim = (s: string | undefined, fallback: string) => (s ?? fallback).replace(/\/$/, "");
export const NETWORK_URL = trim(process.env.NEXT_PUBLIC_NETWORK_URL, "http://localhost:3007");
export const ARTDIRECT_URL = trim(process.env.ARTDIRECT_URL ?? process.env.NEXT_PUBLIC_ARTDIRECT_URL, "http://localhost:3013");
/** This host's own public origin — where /api/drawing/<id>/svg is served from. */
export const FORUM_URL = trim(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3003");
/** The host org subdomains hang off, e.g. arts-collective.com. */
const NETWORK_HOST = (process.env.NETWORK_HOST ?? "localhost:3007").replace(/^https?:\/\//, "");

export const SITE = {
  name: "The Grand Forum",
  tagline: "home to all threads",
};

// This host serves no media; avatars and portraits are stored as paths
// relative to the app that uploaded them. ArtDirect's media route serves
// the whole Nextcloud tree, so everything resolves there.
configureForumMedia((url) => (url.startsWith("/api/media/") ? `${ARTDIRECT_URL}${url}` : url));

/** Where the package's form handler is mounted (see app/api/forum/[action]/route.ts). */
export const ACTION_BASE = "/api/forum";

/** An org's site is its verified domain when it has one, else its network subdomain. */
export const orgSiteUrl = (org: { slug: string; primaryDomain?: string | null }) =>
  org.primaryDomain
    ? `https://${org.primaryDomain}`
    : `${NETWORK_HOST.startsWith("localhost") ? "http" : "https"}://${org.slug}.${NETWORK_HOST}`;

/**
 * Links for the network host. Sign-in goes through this host's own /login,
 * which forwards to the network site with a return address and receives the
 * session back via /api/auth/handoff/accept. Identity pages live on
 * ArtDirect. The wiki and the dictionary are the forum's own routes — this
 * host owns editing them (2026-09-17).
 */
export const hrefs = networkHrefs({
  signIn: "/login",
  profile: (slug) => (slug ? `${ARTDIRECT_URL}/${slug}` : null),
  orgSite: orgSiteUrl,
  // Drawings are made here — this is the host with the editor.
  drawing: (id) => `/draw/${id}`,
  newDrawing: (from) => (from ? `/draw/new?from=${encodeURIComponent(from)}` : "/draw/new"),
});
