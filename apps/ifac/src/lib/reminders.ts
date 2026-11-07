import { createSeriesReminders } from "@elkdonis/series-site/reminders";
import { seriesSite } from "@/lib/series-site";

export const { runReminderTick } = createSeriesReminders(seriesSite);
