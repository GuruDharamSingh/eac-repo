/**
 * Does email actually work, right now, on this machine?
 *
 * Answers the question the hard way — by resolving each org's identity from
 * the database and putting a real request through SendGrid in SANDBOX MODE,
 * which validates the whole message (From, categories, custom args, ASM group,
 * headers) and delivers nothing. A status code is not proof; this is.
 *
 * Run inside a container that has the env:
 *   docker exec -w /app/packages/email <container> \
 *     ./node_modules/.bin/tsx scripts/email-doctor.mts
 */
import { getOrgEmailIdentity, sendEmail } from '../src/index';

const ORGS = ['ifac', 'amrit_canada', 'inner_group', 'hidden-enneagram', 'elkdonis', 'danamccool'];
const PROBE_TO = process.env.EMAIL_DOCTOR_TO ?? 'probe@example.com';

function tick(ok: boolean): string {
  return ok ? '✓' : '✗';
}

async function main(): Promise<void> {
  console.log(`key: ${tick(!!process.env.SENDGRID_API_KEY)} present`);
  console.log(`network From: ${process.env.EMAIL_FROM ?? '(default)'}`);
  console.log(`authenticated domains: ${process.env.EMAIL_AUTHENTICATED_DOMAINS ?? '(EMAIL_FROM only)'}`);
  console.log('');

  let failures = 0;

  for (const orgId of ORGS) {
    const identity = await getOrgEmailIdentity(orgId);
    console.log(`── ${orgId}`);
    console.log(`   From:     "${identity.fromName}" <${identity.fromEmail}>`);
    console.log(`   own domain: ${tick(identity.fromIsOrgDomain)} ${identity.fromIsOrgDomain ? '' : '(falling back to the network address)'}`);
    console.log(`   reply-to: ${identity.replyTo ?? '(none)'}`);
    console.log(`   owners:   ${identity.ownerEmails.join(', ') || '(none)'}`);
    console.log(`   ASM group: ${identity.asmGroupId ?? '(none — bulk mail has no one-click unsubscribe)'}`);

    try {
      const result = await sendEmail({
        to: PROBE_TO,
        subject: `[sandbox] email-doctor — ${orgId}`,
        html: '<p>Validated, not delivered.</p>',
        orgId,
        kind: 'notification',
        sandbox: true,
        // A probe is not a letter the org sent; keep it out of the activity feed.
        noLedger: true,
      });
      console.log(`   sandbox send: ${tick(result.ok)} ok=${result.ok} sandboxed=${result.sandboxed}`);
      if (!result.ok) failures += 1;
    } catch (err) {
      failures += 1;
      console.log(`   sandbox send: ✗ ${(err as Error).message}`);
    }
    console.log('');
  }

  console.log(failures === 0 ? 'all orgs validated' : `${failures} org(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
