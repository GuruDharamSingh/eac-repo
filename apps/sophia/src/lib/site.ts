const trim = (s: string | undefined, fallback: string) => (s ?? fallback).replace(/\/$/, "");

/** This host's public origin — the canonical home of every course URL. */
export const SOPHIA_URL = trim(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3020");
export const NETWORK_URL = trim(process.env.NEXT_PUBLIC_NETWORK_URL, "http://localhost:3007");
export const FORUM_URL = trim(process.env.NEXT_PUBLIC_FORUM_URL, "http://localhost:3003");
export const ARTDIRECT_URL = trim(process.env.ARTDIRECT_URL ?? process.env.NEXT_PUBLIC_ARTDIRECT_URL, "http://localhost:3013");

export const SITE = {
  name: "Sophia",
  tagline: "Courses from the Elkdonis Arts Collective. Free to read, taken at your own pace or together.",
};
