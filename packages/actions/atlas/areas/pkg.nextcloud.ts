import type { Area, Capability, Host, HostKey } from '../types';

// packages/nextcloud: one raw SQL write, the stored Nextcloud credentials. 2026-11-16, round 3.
// Conventions: atlas/JOURNAL.md.

const V = '2026-11-16 read packages/nextcloud/src/users.ts (readStoredCredentials, writeStoredCredentials), auth-server index.ts (session fields)';
const KEY = 'sql:packages/nextcloud/src/users.ts#writeStoredCredentials' as HostKey;
const host: Host = {
  key: KEY,
  service: ['(raw UPDATE users)'],
  address: { app: 'admin', path: '/nextcloud', how: 'no control of its own: the Sync button on the Nextcloud page of apps/admin and the person’s own provision route call handleUserProvisioning, which ends here' },
};

const capabilities: Capability[] = [
  {
    id: 'pkg-nextcloud-credentials-store',
    area: 'pkg.nextcloud',
    label: 'Store a person’s Nextcloud account and app password',
    does: 'When a person’s Nextcloud account is created or repaired, writes users.nextcloud_user_id, users.nextcloud_app_password and nextcloud_synced (by id, falling back to auth_user_id).',
    class: 'internal',
    actors: ['system'],
    scope: 'person',
    hosts: [host],
    status: 'users.nextcloud_synced is true and nextcloud_user_id and nextcloud_app_password are set for the person',
    risk: ['none'],
    drift: 'backs apps.admin.ts:admin-nextcloud-sync-user, admin-nextcloud-sync-users and arts-collective.network:link-cloud-sign-in',
    canonical: 'packages/nextcloud users provisioning (already the single writer)',
    open: 'SECURITY: users.nextcloud_app_password is stored as plain text in the users table. getServerSession reads it into every session object (device and cookie sessions) and caches it in Redis for ten minutes (auth-server index.ts:315, :371), so the credential that opens the person’s whole Nextcloud files tree is in the database, in Redis and in the memory of every request. An app password is revocable in Nextcloud, but nothing here rotates or encrypts it.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
