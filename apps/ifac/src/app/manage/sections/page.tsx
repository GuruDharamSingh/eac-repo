import { getSiteContent, getUpcomingEvents } from "@/lib/data";
import { SectionsEditor } from "@/components/manage/sections-editor";
import { requireIfacManager } from "@/lib/manage-auth";

export const metadata = { title: "Site copy & events — IFAC" };
export const dynamic = "force-dynamic";

/** The words on the public site, and the events the RSVP form hangs off. */
export default async function ManageSectionsPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireIfacManager();
  const [content, events] = await Promise.all([getSiteContent(), getUpcomingEvents(20)]);
  return <SectionsEditor initialContent={content} initialEvents={events} />;
}
