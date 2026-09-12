import Link from "next/link";
import type { Metadata } from "next";
import { getProfile, listAllServiceOfferingsForOrg } from "@elkdonis/services";
import { calculateSkyAt } from "@elkdonis/astro/server";
import { SkyFace } from "@/components/sky";
import { requireOrgMember } from "@/lib/auth";
import { listCharts } from "@/lib/charts";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hub" };
export const dynamic = "force-dynamic";

/**
 * The members' hub, on amrit-canada's model: a grid of tiles, each the small
 * form of the thing it opens, every read done here in parallel.
 *
 * The sky tile is a real face — a live wheel that opens the sky in the shared
 * popup (SurfaceProvider is mounted in the root layout). The rest navigate to
 * pages; they become SurfaceCards as their surfaces are built, without the
 * grid changing shape.
 */
export default async function HubPage() {
  const viewer = await requireOrgMember("/hub");
  const [profile, services, charts] = await Promise.all([
    getProfile(viewer.userId).catch(() => null),
    viewer.canEdit ? listAllServiceOfferingsForOrg(siteConfig.orgId).catch(() => []) : Promise.resolve([]),
    listCharts({ kind: "user", userId: viewer.userId }),
  ]);
  // The face's first chart, rendered on the server like every other tile's data.
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const sky = calculateSkyAt(now, siteConfig.skyLocation.latitude, siteConfig.skyLocation.longitude);
  const published = services.filter((s) => s.status === "published").length;
  const drafts = services.length - published;

  const tiles: {
    href: string;
    title: string;
    blurb: string;
    glyph: string;
    detail?: string;
    editorOnly?: boolean;
    muted?: boolean;
  }[] = [
    {
      href: "/hub/profile",
      title: "My profile",
      blurb: profile?.slug ? `Public at /people/${profile.slug}` : "Portrait, headline, bio and where you are.",
      glyph: "◍",
      detail: profile?.headline ?? profile?.displayName ?? viewer.email,
    },
    {
      href: "/hub/services",
      title: "Services",
      blurb: "Readings and sessions you offer, and their prices.",
      glyph: "☉",
      detail: services.length ? `${published} published · ${drafts} draft${drafts === 1 ? "" : "s"}` : "Nothing listed yet",
      editorOnly: true,
    },
    {
      href: "/charts",
      title: "Your charts",
      blurb: "Every chart you've kept, favourites first.",
      glyph: "☽",
      detail: `${charts.length} chart${charts.length === 1 ? "" : "s"}`,
    },
    {
      href: "/hub",
      title: "Chat",
      blurb: "A room for the group, on the network's Nextcloud Talk.",
      glyph: "◌",
      muted: true,
    },
    {
      href: "/hub",
      title: "Calendar",
      blurb: "Gatherings and sessions, once there are any to put on it.",
      glyph: "▦",
      muted: true,
    },
  ];
  const visible = tiles.filter((t) => !t.editorOnly || viewer.canEdit);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">{siteConfig.orgName}</p>
      <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Hub</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Signed in as {viewer.email}
        {viewer.role ? ` · ${viewer.role}` : ""}. Everything you can manage here lives on the wider Elkdonis network.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkyFace initialIso={now.toISOString()} initialChart={sky} initialIsNow />
        {visible.map((t) =>
          t.muted ? (
            <div
              key={t.title}
              className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground"
              aria-disabled
            >
              <span className="glyph text-2xl">{t.glyph}</span>
              <h2 className="mt-3 font-display text-lg">{t.title}</h2>
              <p className="mt-1 text-sm">{t.blurb}</p>
            </div>
          ) : (
            <Link
              key={t.title}
              href={t.href}
              className={cn(
                "group rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/60",
              )}
            >
              <span className="glyph text-2xl text-primary">{t.glyph}</span>
              <h2 className="mt-3 font-display text-lg group-hover:text-primary">{t.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
              {t.detail && <p className="mt-4 text-xs text-muted-foreground">{t.detail}</p>}
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
