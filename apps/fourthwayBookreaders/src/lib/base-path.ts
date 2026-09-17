/**
 * Where this app is mounted.
 *
 * It is served at `/books` on the shared elkdonis-arts.org rather than on a
 * domain of its own, so Next runs with `basePath`. Next rewrites what it
 * controls — `<Link>`, `useRouter`, `/_next/*`, route matching — and nothing
 * else. Every app-absolute string we write by hand (a `fetch`, a `<form
 * action>`, an `<img src>` read back from the database, `window.location`)
 * still resolves against the DOMAIN root, which on a shared domain is a
 * different app's routes entirely. `withBase` is that missing half.
 *
 * Driven by env, not a literal, so moving to books.elkdonis-arts.org later is
 * dropping one variable rather than editing call sites.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix an app-absolute path with the basePath. Idempotent, and a no-op for
 * a relative path, an external URL, or when there is no basePath at all.
 */
export function withBase(path: string): string {
  if (!BASE_PATH) return path;
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`) || path.startsWith(`${BASE_PATH}?`)) {
    return path;
  }
  return `${BASE_PATH}${path}`;
}

/** withBase for a value that may be absent — media columns are mostly nullable. */
export function withBaseMaybe(path: string | null | undefined): string | null {
  return path ? withBase(path) : null;
}
