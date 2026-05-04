import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { canEditOrgSite, getOrgBySlug } from "@/lib/org";
import { requireUser } from "@/lib/session";
import { Button } from "@/components/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_SILEX_PORT = "6805";

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function resolveSilexEditorUrl(host: string, proto: string): string {
  const configured =
    process.env.SILEX_EDITOR_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_SILEX_URL ??
    process.env.SILEX_PUBLIC_URL;
  if (configured) return configured;

  const hostname = host.split(":")[0] || "localhost";
  const rootHostname = hostname.endsWith(".localhost")
    ? "localhost"
    : hostname;

  return `${proto}://${rootHostname}:${DEFAULT_SILEX_PORT}`;
}

function buildSilexEditorUrl(
  baseUrl: string,
  slug: string,
  searchParams: SearchParams
): string {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("slug", slug);
  return url.toString();
}

export default async function SilexEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug }, query, user, h] = await Promise.all([
    params,
    searchParams,
    requireUser(),
    headers(),
  ]);

  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const canEdit = await canEditOrgSite(user.id, org.id);
  if (!canEdit) notFound();

  const token = firstValue(query.t);

  if (token) {
    const host = h.get("host") ?? "localhost:3007";
    const proto = h.get("x-forwarded-proto") ?? "http";
    const silexEditorUrl = resolveSilexEditorUrl(host, proto);
    redirect(buildSilexEditorUrl(silexEditorUrl, slug, query));
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{org.name}</p>
          <p className="truncate text-xs text-muted-foreground">Silex editor</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/hub">Back to hub</Link>
        </Button>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-3xl">Editor session expired</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Open the editor from your hub again to create a fresh Silex session.
          </p>
          <Button asChild className="mt-6">
            <Link href="/hub">Go to hub</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}