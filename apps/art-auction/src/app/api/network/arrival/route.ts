import { createArrivalHandler } from '@elkdonis/auth-server';
import { siteConfig } from '@/config/site';

/** The arrival notice's data (GET) and its Follow / Not now buttons (POST) — see createArrivalHandler. */
export const dynamic = 'force-dynamic';
export const { GET, POST } = createArrivalHandler({ orgId: siteConfig.marketplaceOrgId });
