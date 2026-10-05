import { handleHandoffAccept } from '@elkdonis/auth-server';

/**
 * Arrive on ArtDirect carrying the network sign-in. Not org-bound: ArtDirect
 * is the person's own page, so no arrival is recorded against an org.
 */
export const dynamic = 'force-dynamic';
export { handleHandoffAccept as GET };
