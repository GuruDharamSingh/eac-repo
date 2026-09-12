import { calculateSkyAt } from "@elkdonis/astro/server";
import { listOrgHomes, listOrgProfiles, listServiceOfferings } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { SkyExplorer } from "@/components/sky-explorer";
import { CenterStrip } from "@/components/center-strip";
import { getViewer } from "@/lib/auth";

interface Props {
  /** ?t=<ISO instant> — the moment to chart. Absent or unparseable means now. */
  searchParams: Promise<{ t?: string }>;
}

/** Whole seconds: the chart is recomputed per request, so a stable string matters more than ms. */
function truncate(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 1000) * 1000);
}

export default async function HomePage({ searchParams }: Props) {
  const { t } = await searchParams;
  const requested = t ? new Date(t) : null;
  const valid = requested && !Number.isNaN(requested.getTime()) ? truncate(requested) : null;
  const at = valid ?? truncate(new Date());

  const { name, latitude, longitude } = siteConfig.skyLocation;
  const sky = calculateSkyAt(at, latitude, longitude);

  // The digest below the chart. Every read fails soft: the sky is the page,
  // and a database hiccup should cost the collective strip, not the chart.
  const [people, services, homes, viewer] = await Promise.all([
    listOrgProfiles(siteConfig.orgId, { onlyPublic: true }).catch(() => []),
    listServiceOfferings(siteConfig.orgId).catch(() => []),
    listOrgHomes().catch(() => []),
    getViewer().catch(() => null),
  ]);

  const sites = homes
    .filter((h) => h.orgId !== siteConfig.orgId && h.primaryDomain)
    .map((h) => ({ orgName: h.orgName, url: `https://${h.primaryDomain}` }));

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:py-8">
      <SkyExplorer initialIso={at.toISOString()} initialChart={sky} initialIsNow={valid === null} locationName={name} />

      <CenterStrip
        data={{
          people,
          services,
          sites,
          // The session carries an email and a role, not a profile — enough
          // to tell the "Your charts" card which of its two faces to wear.
          viewer: viewer ? { signedIn: true, displayName: viewer.email.split("@")[0], avatarUrl: null } : null,
          forumUrl: process.env.NEXT_PUBLIC_FORUM_URL ?? null,
        }}
      />
    </div>
  );
}
