import { createAgentPostHandler } from '@elkdonis/openclaw-bridge';
import { verifyDelegatedToken } from '@/lib/oidc';

/**
 * The single write surface an external agent may use.
 *
 * It lives in admin because admin is already the identity provider — the token
 * this route accepts is minted a few files away, by the same key, and nothing
 * new had to be invented to secure it. A second copy of this route in another
 * app would be a second thing to audit for no gain.
 *
 * What it can do is fixed by the bridge, not by this file: create a DRAFT
 * thread authored by the human the token speaks for, in an org where that
 * human already holds `member` or above. It cannot publish.
 */
export const POST = createAgentPostHandler({
  verify: async (req) => {
    const header = req.headers.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) return null;

    const claims = await verifyDelegatedToken(header.slice(7).trim(), 'agent.post');
    if (!claims) return null;

    return { userId: claims.userId, email: claims.email, clientId: claims.clientId };
  },
});
