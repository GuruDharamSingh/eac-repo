/**
 * Seed each org's email identity into `site_config` key `email:identity`.
 *
 * Idempotent: re-running merges over whatever is there. Safe to edit and
 * re-run as addresses are confirmed or domains become authenticated.
 *
 * NOTE on `fromEmail`: deliberately NOT set here. Until a domain passes
 * validation in SendGrid *and* is listed in EMAIL_AUTHENTICATED_DOMAINS, the
 * identity guard would refuse it anyway — and an unauthenticated From is worse
 * than the network default, because Gmail and Yahoo reject it outright. The
 * From *name*, the reply-to and the unsubscribe group need no DNS, so they go
 * in now.
 */
import { getOrgEmailIdentity, saveOrgEmailIdentity } from '../src/index';

interface Seed {
  orgId: string;
  fromName: string;
  /**
   * Set ONLY for orgs whose domain has passed validation *and* whose address is
   * actually written down somewhere in the repo. An invented address would be a
   * From nobody reads bounces at; an unauthenticated one would be rejected by
   * Gmail outright and is refused by the guard anyway.
   */
  fromEmail?: string;
  replyTo?: string;
  ownerEmails?: string[];
  asmGroupId: number;
}

// Addresses are the ones already documented in .env.example — nothing invented.
const SEEDS: Seed[] = [
  {
    orgId: 'ifac',
    fromName: 'International Fine Art Collectors',
    fromEmail: 'info@ifacgroup.com',
    replyTo: 'info@ifacgroup.com',
    ownerEmails: ['info@ifacgroup.com'],
    asmGroupId: 214755,
  },
  {
    orgId: 'amrit_canada',
    fromName: 'Amrit Canada',
    // The domain is authenticated, so this passes SPF and DKIM whether or not a
    // mailbox exists behind it. Human replies go to the reply-to below, and
    // bounces go to SendGrid via the em7954 return-path — not here. A cPanel
    // forwarder on info@ is still worth adding to catch the stragglers.
    fromEmail: 'info@amritcanada.ca',
    replyTo: 'gurudharamsingh@gmail.com',
    ownerEmails: ['gurudharamsingh@gmail.com'],
    asmGroupId: 214756,
  },
  {
    orgId: 'inner_group',
    fromName: 'InnerGathering',
    fromEmail: 'info@elkdonis-arts.org',
    replyTo: 'info@elkdonis-arts.org',
    ownerEmails: ['info@elkdonis-arts.org'],
    asmGroupId: 214757,
  },
  {
    // No owner address is written down anywhere in the repo for this org, so
    // none is invented here. Add one and re-run.
    orgId: 'hidden-enneagram',
    fromName: 'The Hidden Enneagram',
    asmGroupId: 214758,
  },
  {
    // The network org. It owns two authenticated domains — elkdonis-arts.org
    // and arts-collective.com — so whichever validates first can carry its
    // From address.
    orgId: 'elkdonis',
    fromName: 'Elkdonis Arts Collective',
    fromEmail: 'info@elkdonis-arts.org',
    replyTo: 'info@elkdonis-arts.org',
    ownerEmails: ['info@elkdonis-arts.org'],
    asmGroupId: 214762,
  },
  {
    orgId: 'danamccool',
    fromName: 'Dana McCool',
    replyTo: 'danamccoolart@gmail.com',
    ownerEmails: ['danamccoolart@gmail.com'],
    asmGroupId: 214763,
  },
];

async function main(): Promise<void> {
  for (const seed of SEEDS) {
    const { orgId, ...rest } = seed;
    const result = await saveOrgEmailIdentity(orgId, rest);
    if (!result.ok) {
      console.error(`${orgId}: FAILED — ${result.error}`);
      continue;
    }
    const identity = await getOrgEmailIdentity(orgId);
    console.log(
      `${orgId}: "${identity.fromName}" <${identity.fromEmail}>` +
        `  reply-to=${identity.replyTo ?? '(none)'}` +
        `  owners=${identity.ownerEmails.join(',') || '(none)'}` +
        `  asm=${identity.asmGroupId ?? '(none)'}`
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
