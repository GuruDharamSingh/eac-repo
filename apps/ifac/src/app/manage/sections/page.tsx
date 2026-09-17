import { getSiteContent, getUpcomingEvents } from "@/lib/data";
import { SectionsEditor } from "@/components/manage/sections-editor";

export const metadata = { title: "Site copy & events — IFAC" };
export const dynamic = "force-dynamic";

/** The words on the public site, and the events the RSVP form hangs off. */
export default async function ManageSectionsPage() {
  const [content, events] = await Promise.all([getSiteContent(), getUpcomingEvents(20)]);
  return <SectionsEditor initialContent={content} initialEvents={events} />;
}
