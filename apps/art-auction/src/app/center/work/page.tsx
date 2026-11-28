import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/marketplace-auth";
import { contentHost } from "@/lib/content-host";
import { MyWork } from "@/components/center/my-work";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My work" };

/**
 * "My work": everything the signed-in person has made on the network, in the content library (scope "mine").
 * Built by the content lane (CONTENT_CORNERSTONE Step 3) at /center; moved here on 2026-11-26 when /center became
 * the card page, which links to it from Listings.
 */
export default async function MyWorkPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/center/work");
  const sources = (await contentHost.fileSources?.({ userId }).catch(() => [])) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <Link href="/center" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ‹ Center
        </Link>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">My work</h1>
        <p className="mt-1 text-muted-foreground">Your pieces and files, published or not.</p>
      </header>
      <MyWork timeZone={contentHost.site.timeZone} sources={sources.map((s) => ({ key: s.key, label: s.label }))} />
    </main>
  );
}
