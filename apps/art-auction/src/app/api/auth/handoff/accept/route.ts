import { createHandoffAcceptHandler } from '@elkdonis/auth-server';
import { siteConfig } from '@/config/site';

/**
 * Arrive on this site carrying the sign-in — see handleHandoffAccept. With the
 * org bound, each arrival is recorded (network_arrivals) for the people page
 * and the arrival notice.
 */
export const dynamic = 'force-dynamic';
export const GET = createHandoffAcceptHandler({ orgId: siteConfig.marketplaceOrgId });
