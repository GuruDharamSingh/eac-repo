/**
 * Prove the three layers actually resolve, against the real database.
 *
 * Layer 1 network default → layer 2 the org's words → layer 3 the org's
 * layout. Each is asserted by rendering and looking for a string only that
 * layer could have produced, then the test cleans up after itself.
 */
import {
  renderWelcomeEmail,
  saveOrgTemplate,
  clearOrgTemplate,
  loadOrgTemplate,
  resolveOrgTemplate,
  threadTemplateKey,
  bodyOf,
} from '../src/index';

const ORG = 'ifac';
const THREAD = 'th_layertest';
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function main(): Promise<void> {
  // Start clean so a previous run cannot make this pass.
  await clearOrgTemplate(ORG, 'welcome');
  await clearOrgTemplate(ORG, threadTemplateKey('welcome', THREAD));

  // ── Layer 1 ───────────────────────────────────────────────────────────────
  const base = await renderWelcomeEmail({ displayName: 'Ada', orgName: 'IFAC' });
  check('layer 1: network manifesto present',
    base.includes('raises up more prayer for the objective'));
  check('layer 1: names the org in the confirmation',
    base.includes('created an account with IFAC'));

  // ── Layer 2 ───────────────────────────────────────────────────────────────
  await saveOrgTemplate(ORG, 'welcome', {
    bodyText: 'A sentence only this organisation would write.',
  });
  const stored = await loadOrgTemplate(ORG, 'welcome');
  check('layer 2: stored and read back', stored?.bodyText?.startsWith('A sentence') === true);

  const withWords = await renderWelcomeEmail({
    displayName: 'Ada',
    orgName: 'IFAC',
    bodyText: stored?.bodyText,
  });
  check('layer 2: org words render', withWords.includes('A sentence only this organisation'));
  check('layer 2: network letter SURVIVES the override',
    withWords.includes('raises up more prayer for the objective'));

  // ── Layer 3 ───────────────────────────────────────────────────────────────
  await saveOrgTemplate(ORG, 'welcome', {
    html: '<html><body><table><tr><td>ENTIRELY OUR OWN LAYOUT</td></tr></table></body></html>',
  });
  const both = await loadOrgTemplate(ORG, 'welcome');
  check('layer 3: html stored', !!both?.html);
  check('layer 3: merge kept layer 2 alongside it',
    both?.bodyText?.startsWith('A sentence') === true);
  check('bodyOf() strips the document wrapper',
    bodyOf(both!.html!) === '<table><tr><td>ENTIRELY OUR OWN LAYOUT</td></tr></table>');

  // ── Per-thread override beats the org-wide one ────────────────────────────
  await saveOrgTemplate(ORG, threadTemplateKey('welcome', THREAD), {
    bodyText: 'Only for this one thread.',
  });
  const forThread = await resolveOrgTemplate(ORG, 'welcome', THREAD);
  check('thread key wins over the org key',
    forThread?.bodyText === 'Only for this one thread.',
    `got: ${forThread?.templateKey}`);

  const forOrg = await resolveOrgTemplate(ORG, 'welcome');
  check('without a thread, the org key applies',
    forOrg?.templateKey === 'welcome' && forOrg?.bodyText?.startsWith('A sentence') === true);

  // ── Clean up ──────────────────────────────────────────────────────────────
  await clearOrgTemplate(ORG, 'welcome');
  await clearOrgTemplate(ORG, threadTemplateKey('welcome', THREAD));
  const gone = await loadOrgTemplate(ORG, 'welcome');
  check('cleared, so the network default applies again', gone === null);

  console.log(failures === 0 ? '\nall layers resolve' : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
