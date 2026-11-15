// Runnable check for checkStudioBack (no test runner in this repo). In a container with tsx:
//   cd packages/utils && tsx scripts/check-studio-back.ts
import { checkStudioBack, cleanStudioBackLabel } from '../src/studio-back';

const hosts = ['ifacgroup.com', 'ifac.arts-collective.com', 'localhost:3008'];
const prod = { allowLocalhost: false };
const dev = { allowLocalhost: true };
const long = 'https://ifacgroup.com/' + 'a'.repeat(520);

const cases: Array<[string, string, { allowLocalhost: boolean }, string | null]> = [
  ['plain https', 'https://ifacgroup.com/channel?x=1', prod, 'https://ifacgroup.com/channel?x=1'],
  ['fragment dropped', 'https://ifacgroup.com/a#frag', prod, 'https://ifacgroup.com/a'],
  ['host case-insensitive', 'https://IFACGroup.com/a', prod, 'https://ifacgroup.com/a'],
  ['network subdomain listed', 'https://ifac.arts-collective.com/channel', prod, 'https://ifac.arts-collective.com/channel'],
  ['javascript:', 'javascript:alert(1)', prod, null],
  ['protocol-relative', '//evil.com/x', prod, null],
  ['credentials', 'https://user:pw@ifacgroup.com/', prod, null],
  ['subdomain of allowed host', 'https://evil.ifacgroup.com/', prod, null],
  ['suffix lookalike', 'https://ifacgroup.com.evil.com/', prod, null],
  ['over-long', long, prod, null],
  ['http on real host', 'http://ifacgroup.com/', dev, null],
  ['http localhost, prod', 'http://localhost:3008/channel', prod, null],
  ['http localhost, dev', 'http://localhost:3008/channel', dev, 'http://localhost:3008/channel'],
  ['localhost wrong port', 'http://localhost:9999/', dev, null],
  ['backslash trick', 'https://ifacgroup.com\\@evil.com/', prod, null],
  ['relative path', '/channel', prod, null],
  ['empty', '', prod, null],
];

let failed = 0;
for (const [name, raw, opts, want] of cases) {
  const got = checkStudioBack(raw, hosts, opts);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` -> ${got} (wanted ${want})`}`);
}
const labels: Array<[string, string, string | null]> = [
  ['plain', 'IFAC', 'IFAC'],
  ['trim', '  IFAC  ', 'IFAC'],
  ['angle brackets removed', '<b>x</b>', 'bx/b'],
  ['too long', 'x'.repeat(61), null],
  ['empty', '   ', null],
];
for (const [name, raw, want] of labels) {
  const got = cleanStudioBackLabel(raw);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} label ${name}${ok ? '' : ` -> ${got}`}`);
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
