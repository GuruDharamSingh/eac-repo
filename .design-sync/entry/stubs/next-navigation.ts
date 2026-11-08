// Browser stub for next/navigation. series-site components call useRouter() for refresh/push after
// an RSVP or sign-in; in the design tool there is no Next router, so these are no-ops.
const router = {
  push(_href: string) {},
  replace(_href: string) {},
  refresh() {},
  back() {},
  forward() {},
  prefetch(_href: string) {},
};
export function useRouter() { return router; }
export function usePathname() { return "/"; }
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return {}; }
export function redirect(_href: string): never { throw new Error("redirect() is server-only"); }
export function notFound(): never { throw new Error("notFound() is server-only"); }
