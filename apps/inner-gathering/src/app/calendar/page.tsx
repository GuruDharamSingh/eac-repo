import { getMeetingsByDateRange } from "@/lib/data";
import { CalendarClient } from "@/components/calendar-client";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

export default async function CalendarPage() {
  // Fetch meetings for current month and next month
  const now = new Date();
  const startDate = startOfMonth(now);
  const endDate = endOfMonth(addMonths(now, 1));

  const meetings = await getMeetingsByDateRange(startDate, endDate);

  return <CalendarClient initialMeetings={meetings} />;
}
