import { networkHrefs, configureForumMedia } from "@elkdonis/forum-ui";

const trim = (s: string | undefined, fallback: string) => (s ?? fallback).replace(/\/$/, "");
const NETWORK_URL = trim(process.env.NEXT_PUBLIC_NETWORK_URL, "http://localhost:3007");
const ARTDIRECT_URL = trim(process.env.ARTDIRECT_URL ?? process.env.NEXT_PUBLIC_ARTDIRECT_URL, "http://localhost:3013");
/** The host org subdomains hang off, e.g. arts-collective.com. */
const NETWORK_HOST = (process.env.NETWORK_HOST ?? "localhost:3007").replace(/^https?:\/\//, "");

export const SITE = {
  name: "The Grand Forum",
  tagline: "The conversation of the Elkdonis Arts Collective network",
};

// This host serves no media; avatars and portraits are stored as paths
// relative to the app that uploaded them. ArtDirect's media route serves
// the whole Nextcloud tree, so everything resolves there.
configureForumMedia((url) => (url.startsWith("/api/media/") ? `${ARTDIRECT_URL}${url}` : url));

/**
 * Which skin the board wears. Both stylesheets are imported in globals.css;
 * the modern one is inert unless this says so, because every rule in it is
 * scoped under [data-forum-theme="modern"]. Set FORUM_THEME=modern to flip
 * the whole site — index, feeds, threads, search, members — at once.
 */
export const FORUM_THEME: "classic" | "modern" =
  process.env.FORUM_THEME === "modern" ? "modern" : "classic";

/** Where the package's form handler is mounted (see app/api/forum/[action]/route.ts). */
export const ACTION_BASE = "/api/forum";

/**
 * Links for the network host. Sign-in lives on the network site; identity
 * pages live on ArtDirect; an org's site is its verified domain when it has
 * one, else its network subdomain.
 */
export const hrefs = networkHrefs({
  signIn: `${NETWORK_URL}/login`,
  profile: (slug) => (slug ? `${ARTDIRECT_URL}/${slug}` : null),
  orgSite: (org) => (org.primaryDomain ? `https://${org.primaryDomain}` : `${NETWORK_HOST.startsWith("localhost") ? "http" : "https"}://${org.slug}.${NETWORK_HOST}`),
});
