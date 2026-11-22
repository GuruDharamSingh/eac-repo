// Run: node --experimental-strip-types src/presets/fromCapture.check.mts <edit_v27.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { editFromCapture } from './fromCapture.ts';
const e = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const felt = { path: 'Sounds/felt_hit.wav', name: 'felt hit' };
const r = editFromCapture(e, 'V27', { sounds: { felt_hit: felt }, music: { warm_pad: { path: 'Music/warm_pad.wav' } }, title: 'T' });
assert.equal(r.clip!.segments!.length, 4);
const snd = r.overlays!.items!.find((i) => i.kind === 'sound')!;
assert.equal(snd.at, 6.5); // 3.5 + 2 + 1.0 into segment 3 (lift at source 12.0)
assert.deepEqual(snd.sound, felt);
assert.equal(r.overlays!.items!.find((i) => i.kind === 'title')!.at, 6.85);
assert.equal(r.music!.volume, 0.12);
assert.equal(editFromCapture(e, 'V99').overlays!.items![0].at, 0.3);
console.log('fromCapture.check ok', JSON.stringify(r.overlays!.items!.map((i) => [i.kind, i.at])));
