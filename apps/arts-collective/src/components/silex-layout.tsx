import { SilexSite } from "@elkdonis/silex-render";
import type { OrgSummary } from "@/lib/org";

/**
 * The public-site renderer now lives in @elkdonis/silex-render (shared with the
 * dedicated per-org apps). This thin wrapper keeps the historical `SilexLayout`
 * import + the arts-collective template CSS links.
 */
export function SilexLayout({ org }: { org: OrgSummary }) {
  return (
    <SilexSite
      org={org}
      cssLinks={[
        "/api/silex/templates/workshop.css",
        "/api/silex/templates/enneagram.css",
      ]}
    />
  );
}
