// Server-only surface: collector core and dashboard queries. Import from
// server components, route handlers and scripts, never from client code.
export { getDashboardData, type DashboardOptions } from './queries';
export { recordCollect, visitorId, resolveOptions, type CollectOptions, type CollectRequest } from './collect';
export { parseUserAgent, classifySource } from './classify';
export { getAnalyticsAccess, chooseScope, type AnalyticsAccess } from './access';
export { getAuthorInsights, type AuthorInsights, type PostInsight, type ActivityItem } from './insights';
export { getFunnel, getJourneys, getProgression, type FunnelStep, type FunnelRow, type JourneyRow, type ProgressionData } from './funnel';
