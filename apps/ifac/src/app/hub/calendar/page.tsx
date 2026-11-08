import type { Metadata } from "next";
import { HubCalendar } from "@elkdonis/cms-ui/hubsite";
import { listOrgEventsInRange } from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { HubPageShell } from "@/components/hub/HubPageShell";

export const metadata: Metadata = { title: "Calendar · IFAC Hub" };
export const dynamic = "force-dynamic";

/**
 * The calendar as a page (Cards 2, 2026-10-10). cms-ui's shared
 * `HubCalendar`, the month the Page layout draws: it pages months through
 * the hub connectors' `listEvents` (/api/hub/calendar), and a day opens the
 * calendar popup on that day, through the provider in the hub layout.
 */
export default async function HubCalendarPage() {
  const viewer = await requireOrgMember("/hub/calendar");
  const from = startOfMonth(new Date());
  const events = await listOrgEventsInRange(siteConfig.orgId, from, addMonths(from, 1), 200, viewer).catch(() => []);

  return (
    <HubPageShell
      userId={viewer.userId}
      wide
      crumbs={[{ label: "Hub", href: "/hub" }, { label: "Calendar" }]}
      title="Calendar"
      intro={<p>Everything {siteConfig.shortName} has scheduled. Choose a day to see what is on it.</p>}
    >
      <HubCalendar initialEvents={events} />
    </HubPageShell>
  );
}
