import { createHandoffAcceptHandler } from '@elkdonis/auth-server';
import { siteConfig } from '@/config/site';

/** Arrive on this site carrying the sign-in; each arrival is recorded (network_arrivals) — see handleHandoffAccept. */
export const dynamic = 'force-dynamic';
export const GET = createHandoffAcceptHandler({ orgId: siteConfig.orgId });
