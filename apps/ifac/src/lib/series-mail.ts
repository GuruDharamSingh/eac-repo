import { createSeriesMail } from "@elkdonis/series-site/mail";
import { seriesSite } from "@/lib/series-site";

export type { SeriesMailPurpose } from "@elkdonis/series-site/mail";

export const {
  SITE_ORIGIN,
  TALK_BASE,
  seriesUnsubscribeUrl,
  verifySeriesUnsubscribe,
  comingUrl,
  verifyComing,
  weekUrl,
  whenLine,
  weekTitle,
  upcomingLinks,
  sendHostAssignedEmail,
  answerSeriesWeek,
} = createSeriesMail(seriesSite);
