// Run: node --experimental-strip-types edit.check.mts   (or any TS runner). Exits 1 on failure.
import assert from 'node:assert/strict';
import { buildEdit } from './edit.ts';

const preset = { id: 'V27', shots: [{ id: 's1', say: 'a', by: 'human' as const }, { id: 's5', say: 'title', by: 'machine' as const, engine: 'remotion' }] };
const e = buildEdit(
  preset,
  [
    { shot: 's1', say: 'a', from: 1, to: 3, marks: [], kept: true },
    { shot: 's2', say: 'b', from: 4, to: 5, marks: [], kept: false },
    { shot: 's3', say: 'c', from: 6, to: 8, marks: [{ name: 'lift', t: 7.25 }], kept: true },
  ],
  'x.mp4'
);
assert.deepEqual(e.clip.segments, [{ from: 1, to: 3 }, { from: 6, to: 8 }]);
assert.equal(e.overlays.length, 1);
assert.equal(e.overlays[0].at, 3.25); // 2 s of first segment + 1.25 into the second
assert.equal(e.machine[0].engine, 'remotion');
assert.equal(e.clip.path, 'x.mp4');
console.log('edit.check ok');
