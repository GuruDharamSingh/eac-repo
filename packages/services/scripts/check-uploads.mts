// storeUpload + uploadRoutes against stubbed storage and database: nothing is
// written to Nextcloud or Postgres. Run:
//   node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-uploads.mts
// (inside the admin container, cwd packages/services). Exits 1 on any failure.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { storeUpload, checkUpload, applyNarrow, UPLOAD_POLICIES, type UploadIO } from '../src/uploads';
import { uploadRoutes } from '../src/upload-routes';

let pass = 0;
const failures: string[] = [];
async function t(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    pass++;
    console.log('ok   ', name);
  } catch (e) {
    failures.push(name);
    console.log('FAIL ', name, '\n      ', (e as Error).message);
  }
}

// ---- fixtures ---------------------------------------------------------
const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#c33' } }).png().toBuffer();
const bigJpeg = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#39c' } })
  .withMetadata({ exif: { IFD0: { ImageDescription: 'secret-location-note', Copyright: 'someone' } } })
  .jpeg()
  .toBuffer();
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const html = Buffer.from('<html><script>alert(1)</script></html>');
const mp4 = (n: number) => {
  const b = new Uint8Array(n);
  b.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  return b;
};
const heic = new Uint8Array(64);
heic.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
const frames = Buffer.concat([0, 1, 2].map((i) => Buffer.alloc(8 * 8 * 3, i * 80)));
let gif: Buffer | null = null;
try {
  gif = await sharp(frames, { raw: { width: 8, height: 24, channels: 3, pageHeight: 8 } }).gif({ loop: 0, delay: [100, 100, 100] }).toBuffer();
} catch {
  gif = null;
}

// ---- stubbed IO -------------------------------------------------------
const puts: Array<{ path: string; mime: string; size: number }> = [];
const rows: any[] = [];
const orgAvatars: any[] = [];
const asked: string[] = [];
const members = new Set(['u-member:orgA']);
const io: Partial<UploadIO> = {
  put: async (path, bytes, mime) => (puts.push({ path, mime, size: bytes.byteLength }), true),
  mkdirs: async () => true,
  storageSlug: async (id) => (asked.push(id), id === 'u-noslug' ? null : id === 'u-evil' ? '../evil' : `slug-${id}`),
  ensureUserFolder: async () => true,
  registerLibraryItem: async (item) => (rows.push(item), 'row-1'),
  isOrgMember: async (u, o) => members.has(`${u}:${o}`),
  recordOrgAvatar: async (a) => (orgAvatars.push(a), { recorded: true, versionId: 'v-1' }),
};
const file = (bytes: Uint8Array | Buffer, name = 'a.png', type = 'image/png') => ({ name, type, bytes: new Uint8Array(bytes) });
const run = (input: any) => storeUpload({ actor: { userId: 'u1' }, ...input }, io);
const reset = () => (puts.length = rows.length = orgAvatars.length = asked.length = 0);

// ---- every kind -------------------------------------------------------
for (const kind of ['avatar', 'site', 'personal', 'artwork', 'forum'] as const) {
  const base: any = kind === 'avatar' ? { kind } : { kind, orgId: 'orgA' };
  await t(`${kind}: SVG named .png (image/png) refused 415, nothing written`, async () => {
    reset();
    const r: any = await run({ ...base, file: file(svg, 'a.png', 'image/png') });
    assert.equal(r.ok, false);
    assert.equal(r.status, 415);
    assert.equal(puts.length, 0);
  });
  await t(`${kind}: SVG named .svg (image/svg+xml) refused 415`, async () => {
    const r: any = await run({ ...base, file: file(svg, 'a.svg', 'image/svg+xml') });
    assert.equal(r.status, 415);
  });
  await t(`${kind}: HTML labelled image/jpeg refused 415`, async () => {
    reset();
    const r: any = await run({ ...base, file: file(html, 'a.jpg', 'image/jpeg') });
    assert.equal(r.status, 415);
    assert.equal(puts.length, 0);
  });
  await t(`${kind}: empty file refused 400`, async () => {
    const r: any = await run({ ...base, file: file(new Uint8Array(0)) });
    assert.equal(r.status, 400);
  });
  await t(`${kind}: counted bytes decide (cap + 1 refused, cap passes)`, async () => {
    const n = png.byteLength;
    const pass1: any = await run({ ...base, file: file(png), narrow: { caps: { image: n } } });
    assert.equal(pass1.ok, true);
    const fail1: any = await run({ ...base, file: file(png), narrow: { caps: { image: n - 1 } } });
    assert.equal(fail1.status, 413);
  });
  await t(`${kind}: title and file name traversal stay inside the root`, async () => {
    reset();
    const r: any = await run({ ...base, title: '../../x.png', file: file(png, '..%2f..%2fx.png') });
    assert.equal(r.ok, true);
    assert.ok(!r.path.includes('..') && !r.name.includes('/'), r.path);
    assert.match(r.path, /^EAC_Network\/(orgA|users\/slug-u1)\//);
  });
  await t(`${kind}: names are random-suffixed, a second upload does not collide`, async () => {
    const a: any = await run({ ...base, file: file(png) });
    const b: any = await run({ ...base, file: file(png) });
    assert.notEqual(a.path, b.path);
    assert.match(a.name, /^[a-z0-9-]+-[a-z0-9]+\.(png|jpg)$/);
  });
}

// ---- avatar -----------------------------------------------------------
await t('avatar: lands in the ACTOR tree even with a forged ownerUserId', async () => {
  reset();
  const r: any = await run({ kind: 'avatar', ownerUserId: 'victim', file: file(png) });
  assert.equal(r.ok, true);
  assert.match(r.path, /^EAC_Network\/users\/slug-u1\/Media\/Images\//);
  assert.deepEqual(asked, ['u1']);
});
await t('avatar: 4000x3000 JPEG comes out <= 1024 px with EXIF removed', async () => {
  const r: any = await run({ kind: 'avatar', file: file(bigJpeg, 'big.jpg', 'image/jpeg') });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(Math.max(r.width, r.height) <= 1024, `${r.width}x${r.height}`);
  assert.equal(r.mimeType, 'image/jpeg');
  assert.ok(r.size < bigJpeg.byteLength);
});
await t('avatar: output bytes carry no EXIF (re-read the stored bytes)', async () => {
  let stored: Uint8Array | null = null;
  const r: any = await storeUpload(
    { kind: 'avatar', actor: { userId: 'u1' }, file: file(bigJpeg, 'big.jpg', 'image/jpeg') },
    { ...io, put: async (_p, b) => ((stored = b), true) }
  );
  assert.equal(r.ok, true);
  const meta = await sharp(Buffer.from(stored!)).metadata();
  assert.equal(meta.exif, undefined);
  const src = await sharp(bigJpeg).metadata();
  assert.ok(src.exif, 'fixture really had EXIF');
});
await t('avatar: HEIC gets the friendly message (415)', async () => {
  const r: any = await run({ kind: 'avatar', file: file(heic, 'p.heic', 'image/heic') });
  assert.equal(r.status, 415);
  assert.match(r.error, /HEIC/);
});
await t('avatar: animated GIF is kept as sent', async () => {
  if (!gif) return console.log('      (skipped: this sharp build cannot write GIF)');
  const r: any = await run({ kind: 'avatar', file: file(gif, 'a.gif', 'image/gif') });
  assert.equal(r.ok, true);
  assert.equal(r.mimeType, 'image/gif');
  assert.equal(r.size, gif.byteLength);
});
await t('avatar: over 8 MB refused 413', async () => {
  const r = checkUpload(new Uint8Array(8 * 1024 * 1024 + 1).fill(0xff, 0, 3), UPLOAD_POLICIES.avatar) as any;
  assert.equal(r.status, 413);
});
await t('avatar: no storage folder -> 409', async () => {
  const r: any = await storeUpload({ kind: 'avatar', actor: { userId: 'u-noslug' }, file: file(png) }, io);
  assert.equal(r.status, 409);
});
await t('avatar: a hostile storage slug cannot escape (refused)', async () => {
  reset();
  const r: any = await storeUpload({ kind: 'avatar', actor: { userId: 'u-evil' }, file: file(png) }, io);
  assert.equal(r.ok, false);
  assert.equal(puts.length, 0);
});
await t('avatar (org): non-member refused 403', async () => {
  const r: any = await run({ kind: 'avatar', orgId: 'orgA', file: file(png) });
  assert.equal(r.status, 403);
});
await t('avatar (org): member stores under the org and records it with a version', async () => {
  reset();
  const r: any = await storeUpload({ kind: 'avatar', actor: { userId: 'u-member' }, orgId: 'orgA', file: file(png) }, io);
  assert.equal(r.ok, true);
  assert.match(r.path, /^EAC_Network\/orgA\/Media\/Images\/Avatars\//);
  assert.equal(r.recorded, true);
  assert.equal(r.versionId, 'v-1');
  assert.equal(orgAvatars[0].orgId, 'orgA');
  assert.equal(rows.length, 0, 'avatars are not library items');
});

// ---- site -------------------------------------------------------------
await t('site: PNG labelled video/mp4 goes to Images as image/png', async () => {
  reset();
  const r: any = await run({ kind: 'site', orgId: 'orgA', file: file(png, 'x.mp4', 'video/mp4') });
  assert.equal(r.ok, true);
  assert.match(r.path, /\/orgA\/Media\/Images\//);
  assert.equal(r.mimeType, 'image/png');
});
await t('site: ORGANIZATION visibility lands under Private/Media', async () => {
  const r: any = await run({ kind: 'site', orgId: 'orgA', visibility: 'ORGANIZATION', file: file(png) });
  assert.match(r.path, /\/orgA\/Private\/Media\/Images\//);
});
await t('site: library row gets the right org and the stored name', async () => {
  reset();
  const r: any = await run({ kind: 'site', orgId: 'orgA', file: file(png, 'Nightjar.png') });
  assert.equal(r.id, 'row-1');
  assert.equal(rows[0].orgId, 'orgA');
  assert.equal(rows[0].originalName, 'Nightjar.png');
  assert.equal(rows[0].mediaType, 'image');
});
await t('site: video goes to Videos; PDF-less unknown binary is refused', async () => {
  const v: any = await run({ kind: 'site', orgId: 'orgA', file: file(mp4(2048), 'v.mp4', 'video/mp4') });
  assert.match(v.path, /\/Media\/Videos\//);
  const u: any = await run({ kind: 'site', orgId: 'orgA', file: file(new Uint8Array(500).fill(7), 'x.bin', 'application/octet-stream') });
  assert.equal(u.status, 415);
});
await t('site: no org -> 400 (never invents one)', async () => {
  const r: any = await run({ kind: 'site', file: file(png) });
  assert.equal(r.status, 400);
});

// ---- personal ---------------------------------------------------------
await t('personal: folder traversal refused', async () => {
  for (const folder of ['../../x', 'Images/../x', '..']) {
    const r: any = await run({ kind: 'personal', folder, file: file(png) });
    assert.equal(r.status, 400, folder);
  }
});
await t('personal: gallery regex (good passes, bad 400)', async () => {
  const ok: any = await run({ kind: 'personal', gallery: 'spring-2026', file: file(png) });
  assert.match(ok.path, /users\/slug-u1\/Galleries\/spring-2026\//);
  for (const g of ['../x', 'a/b', 'A B', '-x', '']) {
    if (g === '') continue;
    const r: any = await run({ kind: 'personal', gallery: g, file: file(png) });
    assert.equal(r.status, 400, g);
  }
});
await t('personal: lands in the OWNER the caller authorised, never the form', async () => {
  reset();
  const r: any = await run({ kind: 'personal', ownerUserId: 'artist', file: file(png) });
  assert.match(r.path, /users\/slug-artist\//);
});
await t('personal: no storage folder -> 409', async () => {
  const r: any = await storeUpload({ kind: 'personal', actor: { userId: 'u-noslug' }, file: file(png) }, io);
  assert.equal(r.status, 409);
});
await t('personal: a video in the Images folder is refused', async () => {
  const r: any = await run({ kind: 'personal', file: file(mp4(2048), 'v.mp4', 'video/mp4') });
  assert.equal(r.status, 415);
});

// ---- artwork / forum caps ---------------------------------------------
await t('artwork: video 250 MB passes, 251 MB refused', () => {
  const MB = 1024 * 1024;
  assert.equal((checkUpload(mp4(250 * MB), UPLOAD_POLICIES.artwork) as any).ok, true);
  assert.equal((checkUpload(mp4(251 * MB), UPLOAD_POLICIES.artwork) as any).status, 413);
});
await t('forum: image 15 MB cap (image over cap refused, SVG refused)', () => {
  assert.equal((checkUpload(png, UPLOAD_POLICIES.forum) as any).ok, true);
  assert.equal((checkUpload(svg, UPLOAD_POLICIES.forum) as any).status, 415);
});
await t('applyNarrow can only tighten', () => {
  const p = applyNarrow(UPLOAD_POLICIES.site, { caps: { image: 999 * 1024 * 1024 }, kinds: ['image', 'audio'] });
  assert.equal(p.caps.image, UPLOAD_POLICIES.site.caps.image);
  assert.deepEqual(p.kinds, ['image', 'audio']);
});

// ---- the route factory -----------------------------------------------
const mk = (over: any = {}) =>
  uploadRoutes({ orgId: 'orgA', who: async () => ({ userId: 'u-member' }), kinds: ['avatar', 'site', 'artwork'], io, ...over }).POST;
const req = (fields: Record<string, string>, bytes: Uint8Array = png, name = 'a.png', headers: Record<string, string> = {}) => {
  const f = new FormData();
  f.set('file', new File([bytes], name, { type: 'image/png' }));
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return new Request('http://x/api/uploads', { method: 'POST', body: f, headers });
};
await t('factory: not signed in -> 401', async () => {
  const r = await mk({ who: async () => null })(req({ kind: 'avatar' }));
  assert.equal(r.status, 401);
});
await t('factory: kind not mounted -> 400', async () => {
  const r = await mk()(req({ kind: 'personal' }));
  assert.equal(r.status, 400);
});
await t('factory: site needs canEdit -> 403, with canEdit -> 200', async () => {
  assert.equal((await mk()(req({ kind: 'site' }))).status, 403);
  const r = await mk({ who: async () => ({ userId: 'u1', canEdit: true }) })(req({ kind: 'site' }));
  assert.equal(r.status, 200);
});
await t('factory: artwork and forum refuse without an authorize callback', async () => {
  assert.equal((await mk()(req({ kind: 'artwork' }))).status, 403);
  const ok = await mk({ authorize: async () => ({ ownerUserId: 'u-store' }) })(req({ kind: 'artwork' }));
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).path, /users\/slug-u-store\//);
});
await t('factory: avatar response keeps ok+url (+success) and the network avatar is default', async () => {
  reset();
  const r = await mk()(req({ kind: 'avatar' }));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.ok, true);
  assert.equal(j.success, true);
  assert.match(j.url, /^\/api\/media\/EAC_Network\/users\/slug-u-member\/Media\/Images\//);
  assert.equal(orgAvatars.length, 0);
});
await t('factory: defaultKind overrides a forged kind field', async () => {
  const r = await mk({ defaultKind: 'avatar' })(req({ kind: 'site' }));
  assert.equal(r.status, 200);
  assert.match((await r.json()).path, /\/users\//);
});
await t('factory: scope=org uses the SITE org and ignores a forged orgId field', async () => {
  reset();
  const r = await mk()(req({ kind: 'avatar', scope: 'org', orgId: 'orgB' }));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.match(j.path, /\/orgA\/Media\/Images\/Avatars\//);
  assert.equal(orgAvatars[0].orgId, 'orgA');
});
await t('factory: scope=org by a non-member -> 403', async () => {
  const r = await mk({ who: async () => ({ userId: 'stranger' }) })(req({ kind: 'avatar', scope: 'org' }));
  assert.equal(r.status, 403);
});
await t('factory: a huge Content-Length is refused before the body is read', async () => {
  const r = await mk()(req({ kind: 'avatar' }, png, 'a.png', { 'content-length': String(2 * 1024 * 1024 * 1024) }));
  assert.equal(r.status, 413);
});
await t('factory: SVG sent to the avatar route -> 415 JSON error', async () => {
  const r = await mk()(req({ kind: 'avatar' }, svg, 'a.png'));
  const j = await r.json();
  assert.equal(r.status, 415);
  assert.equal(j.ok, false);
});
await t('factory: an org-less site (arts-collective) refuses scope=org with 400', async () => {
  const r = await mk({ orgId: undefined })(req({ kind: 'avatar', scope: 'org' }));
  assert.equal(r.status, 400);
});

// ---- step 2: legacy site-media shims (same options the app routes pass) --
const MB = 1024 * 1024;
const editor = async () => ({ userId: 'u-ed', canEdit: true });
const shim = (over: any = {}) =>
  mk({ who: editor, kinds: ['site'], defaultKind: 'site', unauthorized: { status: 401, error: 'Unauthorized' }, ...over });
const legacyKeys = (r: any) => ({
  success: true, id: r.id, fileId: r.name, url: r.url, path: r.path,
  filename: r.filename, mimeType: r.mimeType, size: r.size, mediaType: r.mediaType,
});
await t('site shim: /api/upload shape keeps success,id,fileId,url,path,filename,mimeType,size,mediaType', async () => {
  reset();
  const r = await shim({ respond: legacyKeys })(req({ visibility: 'ORGANIZATION', title: 'Nightjar' }));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(j).sort(), ['fileId', 'filename', 'id', 'mediaType', 'mimeType', 'path', 'size', 'success', 'url']);
  assert.equal(j.id, 'row-1');
  assert.equal(j.mediaType, 'image');
  assert.match(j.path, /^EAC_Network\/orgA\/Private\/Media\/Images\/nightjar-/);
  assert.equal(rows.length, 1);
});
await t('site shim: signed out -> 401 {error:"Unauthorized"}; non-editor -> 403', async () => {
  const r = await shim({ who: async () => null })(req({}));
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'Unauthorized');
  assert.equal((await shim({ who: async () => ({ userId: 'u' }) })(req({}))).status, 403);
});
await t('site shim: an image labelled video/mp4 lands in Images; SVG named .png is refused 415', async () => {
  reset();
  const f = new FormData();
  f.set('file', new File([png], 'p.mp4', { type: 'video/mp4' }));
  const r = await shim()(new Request('http://x', { method: 'POST', body: f }));
  assert.match((await r.json()).path, /\/Media\/Images\//);
  assert.equal((await shim()(req({}, svg, 'a.png'))).status, 415);
});
await t('mediaUploadRoutes shape: success,id,url,path,type,name(original)', async () => {
  const respond = (r: any) => ({ success: true, id: r.id, url: r.url, path: r.path, type: r.mediaType, name: r.filename });
  const j = await (await shim({ respond })(req({}, png, 'Nightjar.png'))).json();
  assert.equal(j.name, 'Nightjar.png');
  assert.equal(j.type, 'image');
});
await t('mediaUploadRoutes: occurrence host (authorize true) may upload without canEdit; denied -> 403', async () => {
  const who = async () => ({ userId: 'u-host' });
  assert.equal((await shim({ who, authorize: async () => true })(req({}))).status, 200);
  assert.equal((await shim({ who, authorize: async () => false })(req({}))).status, 403);
});
await t('hidden-enneagram narrow: image and audio only, audio capped at 60 MB, video refused', async () => {
  const narrow = { site: { kinds: ['image', 'audio'], allowText: false, caps: { image: 25 * MB, audio: 60 * MB } } };
  const p = applyNarrow(UPLOAD_POLICIES.site, narrow.site as any);
  assert.deepEqual(p.kinds, ['image', 'audio']);
  assert.equal(p.caps.audio, 60 * MB);
  assert.equal(p.caps.video, undefined);
  assert.equal((await shim({ narrow })(req({}, mp4(2000), 'v.mp4'))).status, 415);
  assert.equal((await shim({ narrow })(req({}))).status, 200);
});
await t('applyNarrow: a kind narrowed away drops its cap (body-size gate tightens)', () => {
  const p = applyNarrow(UPLOAD_POLICIES.site, { kinds: ['image'] } as any);
  assert.deepEqual(Object.keys(p.caps), ['image']);
});
await t('fourthway shape: ok,path,url,name,size; signed out -> 403', async () => {
  const respond = (r: any) => ({ ok: true, path: r.path, url: r.url, name: r.name, size: r.size });
  const j = await (await shim({ respond })(req({}))).json();
  assert.deepEqual(Object.keys(j).sort(), ['name', 'ok', 'path', 'size', 'url']);
  assert.equal((await shim({ who: async () => null, unauthorized: { status: 403, error: 'Not allowed' } })(req({}))).status, 403);
});


console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
process.exit(0);
