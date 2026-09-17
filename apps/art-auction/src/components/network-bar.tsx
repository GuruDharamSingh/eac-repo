import { cookies, headers } from "next/headers";
import { FROM_COOKIE, resolveNetworkApp, returnUrl } from "@/config/network";

/**
 * A thin strip naming the app the visitor came from, with the way back.
 *
 * The marketplace is a separate domain from every site that sends people into
 * it. Without this, a member who pressed "Open a store" on IFAC found
 * themselves on an unfamiliar site with the browser's back button as their
 * only route home — and after a redirect through sign-in, not even that.
 *
 * `?from=` is read from the URL on the way in and remembered for the rest of
 * the visit, because the errand itself (apply → sign in → studio) loses the
 * query string several times over.
 */
export async function NetworkBar() {
  const jar = await cookies();
  // The middleware records `?from=` into the cookie; read the current URL too
  // so the first paint of the landing page already shows the way back.
  const url = (await headers()).get("x-market-url");
  const fromParam = url ? new URL(url, "http://local").searchParams.get("from") : null;
  const app = resolveNetworkApp(fromParam ?? jar.get(FROM_COOKIE)?.value ?? null);
  if (!app) return null;

  return (
    <div className="border-b border-border bg-muted/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2 text-sm">
        <p className="text-muted-foreground">
          You came from <span className="text-foreground">{app.name}</span>. Selling
          and buying happen here; your profile and your organisation stay there.
        </p>
        <a
          href={returnUrl(app)}
          className="shrink-0 underline underline-offset-4 hover:no-underline"
        >
          ← Back to {app.name}
        </a>
      </div>
    </div>
  );
}
