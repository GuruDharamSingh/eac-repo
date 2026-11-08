import type { Metadata } from "next";
import Link from "next/link";
import { listOrgEventsInRange } from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { requireOrgMember } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { CalendarPageView } from "@/components/hub/CalendarPageView";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

/**
 * The expanded calendar the hub tile opens into.
 *
 * `?day=YYYY-MM-DD` opens focused on that day — the tile links here with one
 * when a day has more than one thing on it and there is no single thread to
 * send you to.
 */
export default async function HubCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;
  // Carry ?day through the login round trip, or someone following a link to a
  // particular day lands on the current month having lost what they clicked.
  const viewer = await requireOrgMember(
    day ? `/hub/calendar?day=${encodeURIComponent(day)}` : "/hub/calendar"
  );

  // A malformed ?day is ignored rather than rejected: the calendar is still
  // perfectly usable unfocused, and erroring on a bad link would be worse
  // than quietly opening on this month.
  const focused = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  const from = focused ? monthOf(focused) : startOfMonth(new Date());
  const events = await listOrgEventsInRange(
    siteConfig.orgId,
    from,
    addMonths(from, 1)
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <Link
        href="/hub"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Hub
      </Link>
      <h1 className="mt-2 font-serif text-3xl">Calendar</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Everything {siteConfig.orgName} has scheduled. Gatherings also reach the
        group&rsquo;s Nextcloud calendar, which members can subscribe to on a
        phone or desktop.
      </p>

      <div className="mt-8">
        <CalendarPageView
          initialEvents={events}
          initialDay={focused}
          canEdit={viewer.canEdit}
        />
      </div>
    </div>
  );
}

function monthOf(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}
