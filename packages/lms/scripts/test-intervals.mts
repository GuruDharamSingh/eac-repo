// Fixed test table for the interval clock rules (pure; no database).
//   cd /app/packages/lms && npx tsx scripts/test-intervals.mts
import { addDaysKey, currentInterval, intervalClosesAt, intervalState, isIntervalKey, localDateKey, localMidnight, type IntervalSpec } from '../src/intervals.ts';

let failed = 0;
let n = 0;
function eq(label: string, got: unknown, want: unknown) {
  n++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
}
const at = (iso: string) => new Date(iso);
const TOR = 'America/Toronto';
const KOL = 'Asia/Kolkata';

const daily: IntervalSpec = { everyDays: 1, start: '2026-01-15', end: null, closes: true };
const key = (s: IntervalSpec, iso: string, tz: string) => { const c = currentInterval(s, at(iso), tz); return c.state === 'running' ? c.key : c.state; };

// Toronto is UTC-5 in January: 23:58 on 21 Jan is 04:58Z on 22 Jan; 00:01 on 22 Jan is 05:01Z.
eq('toronto 11:58 pm files under the 21st', key(daily, '2026-01-22T04:58:00Z', TOR), '2026-01-21');
eq('toronto 12:01 am files under the 22nd', key(daily, '2026-01-22T05:01:00Z', TOR), '2026-01-22');
eq('toronto: the 21st is open at 11:58 pm', intervalState(daily, '2026-01-21', at('2026-01-22T04:58:00Z'), TOR), 'open');
eq('toronto: the 21st is closed at 12:01 am', intervalState(daily, '2026-01-21', at('2026-01-22T05:01:00Z'), TOR), 'closed');
// Kolkata is UTC+5:30: 23:58 on 21 Jan is 18:28Z; 00:01 on 22 Jan is 18:31Z.
eq('kolkata 11:58 pm files under the 21st', key(daily, '2026-01-21T18:28:00Z', KOL), '2026-01-21');
eq('kolkata 12:01 am files under the 22nd', key(daily, '2026-01-21T18:31:00Z', KOL), '2026-01-22');
// The same instant, 18:31Z on 21 Jan: still the 21st (13:31) in Toronto, already the 22nd in Kolkata.
eq('same instant, toronto', key(daily, '2026-01-21T18:31:00Z', TOR), '2026-01-21');
eq('same instant, kolkata', key(daily, '2026-01-21T18:31:00Z', KOL), '2026-01-22');
eq('same instant: 21st open for toronto', intervalState(daily, '2026-01-21', at('2026-01-21T18:31:00Z'), TOR), 'open');
eq('same instant: 21st closed for kolkata', intervalState(daily, '2026-01-21', at('2026-01-21T18:31:00Z'), KOL), 'closed');
eq('same instant: 22nd future for toronto', intervalState(daily, '2026-01-22', at('2026-01-21T18:31:00Z'), TOR), 'future');
eq('same instant: 22nd open for kolkata', intervalState(daily, '2026-01-22', at('2026-01-21T18:31:00Z'), KOL), 'open');

// Before the start and after the end.
eq('before start', key(daily, '2026-01-10T12:00:00Z', TOR), 'before');
eq('before start: any key is future', intervalState(daily, '2026-01-15', at('2026-01-10T12:00:00Z'), TOR), 'future');
const ended: IntervalSpec = { everyDays: 1, start: '2026-01-15', end: '2026-01-20', closes: true };
eq('after end', key(ended, '2026-01-21T12:00:00Z', TOR), 'ended');
eq('after end: the last day is closed', intervalState(ended, '2026-01-20', at('2026-01-21T12:00:00Z'), TOR), 'closed');
eq('a day past the end is not an interval', isIntervalKey(ended, '2026-01-21'), false);
eq('a key before the start is not an interval', isIntervalKey(daily, '2026-01-14'), false);

// Weekly (every 7 days from Monday 5 Jan): the boundary is Sunday night to Monday morning, local.
const weekly: IntervalSpec = { everyDays: 7, start: '2026-01-05', end: null, closes: true };
eq('week: Sunday 11:58 pm Toronto is still the week of the 5th', key(weekly, '2026-01-12T04:58:00Z', TOR), '2026-01-05');
eq('week: Monday 12:01 am Toronto is the week of the 12th', key(weekly, '2026-01-12T05:01:00Z', TOR), '2026-01-12');
eq('week: Wednesday mid-week', key(weekly, '2026-01-14T15:00:00Z', TOR), '2026-01-12');
eq('week: a day inside a week is not a key', isIntervalKey(weekly, '2026-01-13'), false);
eq('week: the 12th is a key', isIntervalKey(weekly, '2026-01-12'), true);
eq('week closes at the next Monday midnight, Toronto', intervalClosesAt(weekly, '2026-01-05', TOR).toISOString(), '2026-01-12T05:00:00.000Z');
eq('week: kolkata Monday 12:01 am is already the next week', key(weekly, '2026-01-11T18:31:00Z', KOL), '2026-01-12');

// Every 3 days.
const three: IntervalSpec = { everyDays: 3, start: '2026-01-01', end: null, closes: true };
eq('3-day: day 1 and 2 and 3 share a key', [key(three, '2026-01-01T15:00:00Z', TOR), key(three, '2026-01-02T15:00:00Z', TOR), key(three, '2026-01-03T15:00:00Z', TOR)], ['2026-01-01', '2026-01-01', '2026-01-01']);
eq('3-day: day 4 starts the next', key(three, '2026-01-04T15:00:00Z', TOR), '2026-01-04');

// Late entries allowed (closes false): a past interval stays open.
const late: IntervalSpec = { ...daily, closes: false };
eq('closes=false keeps a past interval open', intervalState(late, '2026-01-21', at('2026-01-25T12:00:00Z'), TOR), 'open');
eq('closes=false never opens the future', intervalState(late, '2026-01-26', at('2026-01-25T12:00:00Z'), TOR), 'future');

// DST: Toronto springs forward on Sunday 8 March 2026 (02:00 -> 03:00). The 8th has 23 hours; the 9th starts at 04:00Z.
eq('dst: 7 Mar 11:58 pm EST is the 7th', localDateKey(at('2026-03-08T04:58:00Z'), TOR), '2026-03-07');
eq('dst: 8 Mar 12:01 am EST is the 8th', localDateKey(at('2026-03-08T05:01:00Z'), TOR), '2026-03-08');
eq('dst: 8 Mar 11:58 pm EDT is the 8th', localDateKey(at('2026-03-09T03:58:00Z'), TOR), '2026-03-08');
eq('dst: 9 Mar 12:01 am EDT is the 9th', localDateKey(at('2026-03-09T04:01:00Z'), TOR), '2026-03-09');
eq('dst: midnight of the 9th is 04:00Z, not 05:00Z', localMidnight('2026-03-09', TOR).toISOString(), '2026-03-09T04:00:00.000Z');
eq('dst: the 8th closes at 04:00Z on the 9th', intervalClosesAt({ ...daily, start: '2026-03-01' }, '2026-03-08', TOR).toISOString(), '2026-03-09T04:00:00.000Z');
// Autumn: Toronto falls back on Sunday 1 Nov 2026 (the 1st has 25 hours); midnight of the 2nd is 05:00Z.
eq('dst autumn: 1 Nov 11:58 pm EST is the 1st', localDateKey(at('2026-11-02T04:58:00Z'), TOR), '2026-11-01');
eq('dst autumn: midnight of the 2nd is 05:00Z', localMidnight('2026-11-02', TOR).toISOString(), '2026-11-02T05:00:00.000Z');
eq('weekly across the fall-back stays on Mondays', key({ everyDays: 7, start: '2026-10-26', end: null, closes: true }, '2026-11-02T05:30:00Z', TOR), '2026-11-02');

// Helpers and bad input.
eq('addDaysKey', addDaysKey('2026-02-27', 3), '2026-03-02');
eq('unknown zone falls back to Toronto', localDateKey(at('2026-01-22T04:58:00Z'), 'Not/AZone'), '2026-01-21');
eq('non-date key is invalid', isIntervalKey(daily, '2026-02-30'), false);

console.log(failed === 0 ? `intervals: ${n} checks passed` : `intervals: ${failed} of ${n} FAILED`);
process.exit(failed ? 1 : 0);
