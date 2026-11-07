import {
  getPresentedSeries as presented,
  getSeriesBySlug as bySlug,
  getSeriesWeek as week,
  hostCards as hosts,
} from "@elkdonis/series-site/lib";
import type { MeetingSeries } from "@elkdonis/services";
import { seriesSite } from "@/lib/series-site";

export { canSeeDraftWeek, canSeeMaterials, isAnnouncedCancellation, isViewerSubscribed, nextPublicSession, publicSessions } from "@elkdonis/series-site/lib";
export type { HostCard } from "@elkdonis/series-site/lib";

export const getPresentedSeries = (options?: { count?: number }) => presented(seriesSite, options);
export const getSeriesBySlug = (slug: string, options?: { count?: number; pastCount?: number }) => bySlug(seriesSite, slug, options);
export const getSeriesWeek = (slug: string, n: number) => week(seriesSite, slug, n);
export const hostCards = (series: MeetingSeries) => hosts(seriesSite, series);
