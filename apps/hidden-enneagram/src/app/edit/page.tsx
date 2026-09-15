import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildSilexEditorUrl, resolveSilexEditorUrl } from "@elkdonis/silex-render";
import { getViewer } from "@/lib/auth";
import { ORG_SLUG } from "@/lib/session";

/**
 * The gate between this site and the Silex editor.
 *
 * `/edit?t=<token>&page=<id>` checks the viewer may edit, then bounces to the
 * editor origin with the token and page attached. Without a token it is the
 * page a stale link lands on, so it says why rather than 404ing.
 *
 * A static route, so it beats the `[page]` segment — the same precedence
 * /services and /about already rely on.
 */
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function EditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [viewer, query, h] = await Promise.all([getViewer(), searchParams, headers()]);

  if (!viewer) redirect("/login?next=%2Fedit");
  if (!viewer.canEdit) redirect("/");

  const token = Array.isArray(query.t) ? query.t[0] : query.t;
  if (token) {
    const host = h.get("host") ?? "localhost";
    const proto = h.get("x-forwarded-proto") ?? "http";
    redirect(buildSilexEditorUrl(resolveSilexEditorUrl(host, proto), ORG_SLUG, query));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl">Editor session expired</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Editor links are single-use and last ten minutes. Open the page you
          want to change and use &ldquo;Edit page&rdquo; again.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-primary no-underline"
        >
          Back to the site &rarr;
        </Link>
      </div>
    </main>
  );
}
