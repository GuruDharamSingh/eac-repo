/**
 * Proves the email suite's server layer against the REAL database.
 *
 * Not a unit test: every assertion below goes through postgres, because the
 * things that break here are SQL shapes (partial-index ON CONFLICT, the
 * three-source merge, jsonb encoding) that a mocked driver would happily
 * accept. Cleans up everything it writes.
 *
 *   docker exec -w /app/packages/email eac-arts-network \
 *     ./node_modules/.bin/tsx scripts/test-suite.mts
 */
import { db } from '@elkdonis/db';
import {
  parseInboundRecipient, classifyInbound, addressOf, displayNameOf,
  recordInbound, listInbox, unreadCount, setInboxState, reclassifyInbox,
  inboundAddressFor, inboundAddressForThread,
  listAddressBook, parseAddressList, addAddresses, updateContact, removeContact,
  recordSend, ingestEvents, recentActivity, deliveryStats,
  getOrgEmailIdentity, saveOrgEmailIdentity, clearEmailIdentityCache,
} from '../src/index';

const ORG = 'ifac';
let pass = 0, fail = 0;
const written = { inbox: [] as string[], contacts: [] as string[], sends: [] as string[], events: [] as string[] };

function ok(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${detail}`); }
}

console.log('\n── addressing ──');
const orgIds = (await db`SELECT id FROM organizations`).map((r) => r.id as string);
ok('org-only address resolves', parseInboundRecipient('ifac@inbound.elkdonis-arts.org', orgIds).orgId === 'ifac');
ok('underscore org resolves via hyphen', parseInboundRecipient('amrit-canada@x.org', orgIds).orgId === 'amrit_canada');
ok('hyphen org resolves as itself', parseInboundRecipient('hidden-enneagram@x.org', orgIds).orgId === 'hidden-enneagram');
const withThread = parseInboundRecipient('ifac.abc123XYZ@x.org', orgIds);
ok('thread token parsed', withThread.orgId === 'ifac' && withThread.threadId === 'abc123XYZ', JSON.stringify(withThread));
ok('unknown org is null, not a guess', parseInboundRecipient('nosuchorg@x.org', orgIds).orgId === null);
ok('address round-trips', parseInboundRecipient(inboundAddressFor('amrit_canada'), orgIds).orgId === 'amrit_canada');
ok('thread address round-trips',
  parseInboundRecipient(inboundAddressForThread('ifac', 'th_XYZ'), orgIds).threadId === 'th_XYZ');

console.log('\n── parsing ──');
ok('addressOf strips angle brackets', addressOf('Jane Doe <Jane@Example.com>') === 'jane@example.com');
ok('displayNameOf reads the name', displayNameOf('"Jane Doe" <j@e.com>') === 'Jane Doe');
ok('displayNameOf is null for a bare address', displayNameOf('j@e.com') === null);

console.log('\n── classification ──');
ok('auto-submitted → auto',
  classifyInbound({ fromEmail: 'a@b.com', headers: { 'Auto-Submitted': 'auto-replied' }, hasThread: true }) === 'auto');
ok('mailer-daemon → bounce', classifyInbound({ fromEmail: 'MAILER-DAEMON@x.com', hasThread: false }) === 'bounce');
ok('high spam score → spam', classifyInbound({ fromEmail: 'a@b.com', spamScore: 7.2, hasThread: false }) === 'spam');
ok('thread → reply', classifyInbound({ fromEmail: 'a@b.com', hasThread: true }) === 'reply');
ok('no thread → enquiry', classifyInbound({ fromEmail: 'a@b.com', hasThread: false }) === 'enquiry');
ok('out of office → auto',
  classifyInbound({ fromEmail: 'a@b.com', subject: 'Out of office: re your note', hasThread: true }) === 'auto');

console.log('\n── inbox ──');
const id1 = await recordInbound({
  orgId: ORG, fromEmail: 'probe-suite@example.com', fromName: 'Probe',
  toEmail: 'ifac@inbound.elkdonis-arts.org', subject: 'Test enquiry',
  bodyText: 'hello', classification: 'enquiry',
  attachments: [{ name: 'a.pdf', type: 'application/pdf', size: 12 }],
  envelope: { to: ['ifac@inbound.elkdonis-arts.org'] },
  messageId: '<probe-suite-1@example.com>',
});
ok('recorded', Boolean(id1));
if (id1) written.inbox.push(id1);

const dupe = await recordInbound({
  orgId: ORG, fromEmail: 'probe-suite@example.com', toEmail: 'ifac@inbound.elkdonis-arts.org',
  subject: 'Test enquiry', classification: 'enquiry', messageId: '<probe-suite-1@example.com>',
});
ok('duplicate Message-ID deduped (partial-index ON CONFLICT)', dupe === null, `got ${dupe}`);

const noId = await recordInbound({
  orgId: ORG, fromEmail: 'probe-suite2@example.com', toEmail: 'ifac@inbound.elkdonis-arts.org',
  subject: 'No message id', classification: 'enquiry', messageId: null,
});
ok('a message with no Message-ID is still stored', Boolean(noId));
if (noId) written.inbox.push(noId);

const inbox = await listInbox(ORG, { limit: 10 });
ok('listInbox returns them', inbox.some((m) => m.id === id1));
const found = inbox.find((m) => m.id === id1)!;
ok('attachments survive jsonb round-trip', found?.attachments?.[0]?.name === 'a.pdf', JSON.stringify(found?.attachments));

const before = await unreadCount(ORG);
ok('unread counts them', before >= 2, `${before}`);
await setInboxState(ORG, id1!, 'read');
ok('marking read drops the count', (await unreadCount(ORG)) === before - 1);
await reclassifyInbox(ORG, id1!, 'spam');
ok('spam is hidden from the default list', !(await listInbox(ORG)).some((m) => m.id === id1));
ok('spam is visible when asked for', (await listInbox(ORG, { filter: 'all' })).some((m) => m.id === id1));
ok('cross-org read is refused', (await listInbox('amrit_canada', { filter: 'all' })).every((m) => m.id !== id1));

console.log('\n── address book ──');
const parsed = parseAddressList(`
  plain@example.com
  Jane Doe <jane@example.com>
  Bob Smith, bob@example.com
  not-an-address-at-all
`);
ok('three shapes parsed', parsed.addresses.length === 3, JSON.stringify(parsed.addresses));
ok('name from angle form', parsed.addresses[1]?.name === 'Jane Doe');
ok('name from CSV form', parsed.addresses[2]?.name === 'Bob Smith', JSON.stringify(parsed.addresses[2]));
ok('junk is reported, not dropped', parsed.rejected.length === 1);

const add = await addAddresses({ orgId: ORG, text: 'suite-probe-a@example.com\nSuite B <suite-probe-b@example.com>', tags: ['probe'] });
ok('two added', add.added === 2, JSON.stringify(add));
const again = await addAddresses({ orgId: ORG, text: 'suite-probe-a@example.com' });
ok('re-adding updates rather than duplicating', again.added === 0 && again.updated === 1, JSON.stringify(again));

const book = await listAddressBook(ORG);
const probeA = book.find((e) => e.email.toLowerCase() === 'suite-probe-a@example.com');
ok('manual entry appears with source', probeA?.sources.includes('manual') === true, JSON.stringify(probeA?.sources));
ok('tags stored', probeA?.tags.includes('probe') === true);
ok('members are merged in', book.some((e) => e.sources.includes('member')), `${book.length} entries`);
ok('no duplicate addresses', new Set(book.map((e) => e.email.toLowerCase())).size === book.length);
ok('everyone in the book is mailable or unsubscribed',
  book.every((e) => e.mailable === (e.status !== 'unsubscribed')));

for (const e of ['suite-probe-a@example.com', 'suite-probe-b@example.com']) {
  const [row] = await db`SELECT id FROM contacts WHERE org_id = ${ORG} AND lower(email) = ${e}`;
  if (row) written.contacts.push(row.id as string);
}
if (written.contacts[0]) {
  await updateContact({ orgId: ORG, contactId: written.contacts[0], notes: 'a note' });
  const b2 = await listAddressBook(ORG);
  ok('notes save', b2.find((e) => e.id === written.contacts[0])?.notes === 'a note');
}

console.log('\n── ledger ──');
const sendId = await recordSend({
  orgId: ORG, kind: 'newsletter', toEmail: 'suite-probe-a@example.com',
  subject: 'Suite probe', sgMessageId: 'suite-probe-msg-1', status: 'queued',
});
ok('send recorded', Boolean(sendId));
if (sendId) written.sends.push(sendId);

const ing = await ingestEvents([
  { sg_event_id: 'suite-ev-1', sg_message_id: 'suite-probe-msg-1', email: 'suite-probe-a@example.com', event: 'delivered', timestamp: Math.floor(Date.now() / 1000), orgId: ORG },
]);
written.events.push('suite-ev-1');
ok('event stored', ing.stored === 1, JSON.stringify(ing));
const [s1] = await db`SELECT status FROM email_sends WHERE id = ${sendId!}`;
ok('send folded to delivered', s1?.status === 'delivered', String(s1?.status));

const replay = await ingestEvents([
  { sg_event_id: 'suite-ev-1', sg_message_id: 'suite-probe-msg-1', email: 'suite-probe-a@example.com', event: 'delivered', orgId: ORG },
]);
ok('replayed event is deduped', replay.stored === 0, JSON.stringify(replay));

await ingestEvents([
  { sg_event_id: 'suite-ev-2', sg_message_id: 'suite-probe-msg-1', email: 'suite-probe-b@example.com', event: 'bounce', reason: 'mailbox does not exist', timestamp: Math.floor(Date.now() / 1000), orgId: ORG },
]);
written.events.push('suite-ev-2');
const [bounced] = await db`SELECT status FROM contacts WHERE org_id = ${ORG} AND lower(email) = 'suite-probe-b@example.com'`;
ok('a bounce suppresses the address — the loop closes', bounced?.status === 'unsubscribed', String(bounced?.status));
const book3 = await listAddressBook(ORG);
ok('a suppressed address is not mailable',
  book3.find((e) => e.email.toLowerCase() === 'suite-probe-b@example.com')?.mailable === false);

await ingestEvents([
  { sg_event_id: 'suite-ev-3', sg_message_id: 'suite-probe-msg-1', email: 'suite-probe-a@example.com', event: 'open', orgId: ORG },
]);
written.events.push('suite-ev-3');
const stats = await deliveryStats(ORG, 'newsletter');
ok('stats read the ledger, not the attempts', stats.sent >= 1, JSON.stringify(stats));

const activity = await recentActivity(ORG, 20);
ok('activity has both directions',
  activity.some((a) => a.direction === 'sent') && activity.some((a) => a.direction === 'received'),
  JSON.stringify(activity.map((a) => a.direction)));
ok('activity is newest-first',
  activity.every((a, i) => i === 0 || activity[i - 1].at >= a.at));

console.log('\n── identity merge (the wipe bug) ──');
// The STORED row, not the resolved identity. `getOrgEmailIdentity` substitutes
// the network's authenticated From when an org's own domain isn't verified
// yet, so restoring from the resolved object writes that fallback back into
// storage and quietly loses the org's real setting — which is exactly what
// this restore did the first time it ran, on ifac.
const [storedRow] = await db<Array<{ value: Record<string, unknown> | null }>>`
  SELECT value FROM site_config WHERE org_id = ${ORG} AND key = 'email:identity'`;
const storedBefore = storedRow?.value ?? null;
const original = await getOrgEmailIdentity(ORG);
await saveOrgEmailIdentity(ORG, { palette: { accent: '#123456', onAccent: '#ffffff' } });
clearEmailIdentityCache(ORG);
const afterPalette = await getOrgEmailIdentity(ORG);
ok('saving ONLY a palette keeps the From address',
  afterPalette.fromEmail === original.fromEmail, `${original.fromEmail} → ${afterPalette.fromEmail}`);
ok('saving ONLY a palette keeps the owner list',
  JSON.stringify(afterPalette.ownerEmails) === JSON.stringify(original.ownerEmails));
ok('the palette actually stored', afterPalette.palette?.accent === '#123456');
await saveOrgEmailIdentity(ORG, { palette: { accent: 'red; background:url(javascript:alert(1))' } });
clearEmailIdentityCache(ORG);
ok('a non-hex palette value is refused, not stored',
  (await getOrgEmailIdentity(ORG)).palette?.accent !== 'red; background:url(javascript:alert(1))');
ok('inbound replies default to off', (await getOrgEmailIdentity(ORG)).inboundReplies === false);
// Put the row back byte for byte.
if (storedBefore) {
  await db`
    INSERT INTO site_config (org_id, key, value)
    VALUES (${ORG}, 'email:identity', ${db.json(storedBefore as never)})
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value`;
} else {
  await db`DELETE FROM site_config WHERE org_id = ${ORG} AND key = 'email:identity'`;
}
clearEmailIdentityCache(ORG);
const [afterRestore] = await db<Array<{ value: Record<string, unknown> | null }>>`
  SELECT value FROM site_config WHERE org_id = ${ORG} AND key = 'email:identity'`;
ok('the identity row is restored byte for byte',
  JSON.stringify(afterRestore?.value ?? null) === JSON.stringify(storedBefore),
  `${JSON.stringify(storedBefore)} vs ${JSON.stringify(afterRestore?.value ?? null)}`);

console.log('\n── cleanup ──');
if (written.inbox.length) await db`DELETE FROM email_inbox WHERE id IN ${db(written.inbox)}`;
if (written.sends.length) await db`DELETE FROM email_sends WHERE id IN ${db(written.sends)}`;
if (written.events.length) await db`DELETE FROM email_events WHERE sg_event_id IN ${db(written.events)}`;
await db`DELETE FROM contacts WHERE org_id = ${ORG} AND email LIKE 'suite-probe-%'`;
const leftInbox = await db`SELECT count(*)::int n FROM email_inbox WHERE from_email LIKE 'probe-suite%'`;
const leftContacts = await db`SELECT count(*)::int n FROM contacts WHERE email LIKE 'suite-probe-%'`;
ok('cleaned up', leftInbox[0].n === 0 && leftContacts[0].n === 0);

console.log(`\n${fail === 0 ? '✓' : '✗'} ${pass} passed, ${fail} failed\n`);
await db.end();
process.exit(fail === 0 ? 0 : 1);
