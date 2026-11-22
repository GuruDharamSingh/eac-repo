import type { Area, Capability, Host, HostKey } from '../types';

// danamccool (single artist site): contact form, media upload, navigation. Round 2 (2026-11-16).
// The gallery family is already in orgapps.content; the security lead on guides editing the owner's
// galleries (#15) applies to the media upload below as well.

const V =
  '2026-11-16 read apps/danamccool/src/app/api/{contact,media/upload,pulse,auth/signup}/route.ts, lib/{hud-actions,navigation-actions,navigation-store,navigation,auth}.ts; components/hud, app/studio/navigation callers by grep';
const A = 'danamccool';
const AREA = 'dana.site';
const k = (kind: 'sa' | 'api' | 'sql', p: string, s: string) => `${kind}:apps/danamccool/src/${p}#${s}` as HostKey;
const api = (p: string, m: string) => k('api', `app/api/${p}/route.ts`, m);
const h = (key: HostKey, path: string, how: string, service: string[], note?: string): Host => ({
  key,
  service,
  address: { app: A, path, how },
  ...(note ? { note } : {}),
});
const twin = (key: HostKey, of: HostKey): Host => ({ key, note: `sql twin of ${of}` });
const cf = (text: string) => ({ text, status: 'draft' as const, wave: 6 });
const mk = (c: Omit<Capability, 'verified' | 'area'>): Capability => ({ area: AREA, verified: V, ...c });

const capabilities: Capability[] = [
  mk({
    id: 'dana-media-upload',
    label: 'Upload a picture to the site',
    does: "Uploads an image (25 MB, bytes sniffed) into the SITE OWNER's own Nextcloud storage (Media/Images, or Galleries/<gallery> after creating that folder) and records it for danamccool.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      h(api('media/upload', 'POST'), '/studio', 'upload in the galleries panel and the page editor (components/hud/galleries-panel.tsx, lib/puck/config.client.ts)', ['(getViewer().canEdit = owner or guide)', '(getSiteOwnerUserId storage slug)', '@elkdonis/services#createUserFolder', '@elkdonis/services#uploadFile', '@elkdonis/services#resolveUserPath', '@elkdonis/utils#validateUploadBuffer']),
    ],
    entry: null,
    status: 'a media row for danamccool exists with the Nextcloud path under the owner folder',
    risk: ['public'],
    confirm: cf('Add “{file}” to the pictures on {org}? Visitors can see it where it is used.'),
    inputs: 'file, title, gallery (slug pattern checked)',
    drift: 'Since 2026-11-20 the route is a shim on mediaUploadRoute (packages/services/src/media-upload-route.ts); its insert is inside the factory closure, which the inventory does not list as a host, so there is no sql twin key any more. Upload family (ifac api/upload, artdirect api/upload, hidden-enneagram api/upload). Here the destination is the owner personal folder under the site org, whoever uploads.',
    canonical: 'services uploadUserFile with validateUploadBuffer and a per-app authorizer.',
    open: "SECURITY (extends lead #15): apps/danamccool/src/app/api/media/upload/route.ts:34-66 a guide (canEdit) writes files into the site owner's personal storage (EAC_Network/users/<owner>/...), the same ownership blur as the guide editing the owner's galleries; gallery slug is pattern-checked (good) but the folder is created under the owner for any value that matches.",
  }),
  mk({
    id: 'dana-navigation-save',
    label: 'Edit the site menu',
    does: 'Saves the main navigation (up to a cap of items, https or /path links only) for the site.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      h(k('sa', 'lib/navigation-actions.ts', 'saveNavAction'), '/studio/navigation', 'Navigation editor tab (app/studio/navigation/page.tsx, components/studio/editor-tabs.tsx)', ['(getViewer().canEdit = owner or guide; the error text says only the site owner)', '(cleanNav: labels 60, hrefs 200, protocol-relative and non-http(s) refused)']),
    ],
    entry: null,
    status: "site_config nav:main for danamccool holds the cleaned items (loadNav)",
    risk: ['public'],
    confirm: cf('Save this menu on {org}? Visitors see it on every page at once.'),
    inputs: 'items [{ label, href, sub }]',
    drift: 'Since 2026-11-20 saveNav calls saveSiteNav (packages/services/src/nav.ts), whose db write is not an inventory host, so the old sql twin key is gone. Same shape as hidden-enneagram he-audio-config-save (a site_config key saved by an editor with a cleaning function); no other app has a menu editor.',
    canonical: 'a shared site_config save helper (org-scoped, cleaned).',
    open: 'The refusal message says "Only the site owner" while the check is canEdit (owner or guide): either the message or the gate is wrong.',
  }),
];

export default {
  capabilities,
  ignored: [
    { key: k('sa', 'lib/hud-actions.ts', 'listPagesForHud'), why: 'read exposed as a server action: lists pages and linked galleries for the manager' },
    { key: k('sa', 'lib/hud-actions.ts', 'loadMediaCatalog'), why: 'read exposed as a server action: lists files and where each is used' },
    { key: k('sa', 'lib/navigation-actions.ts', 'loadNavForEditor'), why: 'read exposed as a server action: loads the menu and the page candidates for the editor' },
  ],
} satisfies Area;
