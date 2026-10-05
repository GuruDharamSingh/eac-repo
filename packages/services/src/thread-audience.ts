// ============================================================================
// Who may read a thread (pure: no database import, so a client component may
// use it): the audience choices, how each is stored, and the
// checks that apply them. See migration 188.
//
// The audience a writer picks maps onto two columns:
//
//   everyone   PUBLIC
//   followers  ORGANIZATION                      any role in the org, followers included
//   members    INVITE_ONLY + min_role 'member'   members, guides, owners
//   guides     INVITE_ONLY + min_role 'guide'    guides and owners
//   owners     INVITE_ONLY + min_role 'owner'    owners
//   author     INVITE_ONLY, no min_role          the author only
//
// Narrow audiences use INVITE_ONLY so a query that predates min_role hides the
// row (fail closed). Platform admins (users.is_admin) read everything; the
// author reads their own. Roles are per org: an owner of one org has no
// standing in another.
// ============================================================================

export type ThreadRole = 'viewer' | 'member' | 'guide' | 'owner';
export type Audience = 'everyone' | 'followers' | 'members' | 'guides' | 'owners' | 'author';

const RANK: Record<ThreadRole, number> = { viewer: 1, member: 2, guide: 3, owner: 4 };
/** Role order for callers that compare roles (higher outranks lower). */
export const RANK_OF = RANK;

export const AUDIENCES: Array<{ value: Audience; label: string; hint: string }> = [
  { value: 'everyone', label: 'Everyone', hint: 'Anyone with the link, signed in or not. Listed on the public pages.' },
  { value: 'followers', label: 'Followers and above', hint: 'People signed in who follow this organisation, and its members, guides and owners.' },
  { value: 'members', label: 'Members', hint: 'Members, guides and owners. Followers cannot see it.' },
  { value: 'guides', label: 'Guides and owners', hint: 'The people who run this organisation.' },
  { value: 'owners', label: 'Owners only', hint: 'Only the organisation’s owners (and you, as author).' },
  { value: 'author', label: 'Only me', hint: 'Visible to you alone, as a private note.' },
];

export function audienceToStorage(a: Audience): { visibility: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY'; minRole: ThreadRole | null } {
  switch (a) {
    case 'everyone': return { visibility: 'PUBLIC', minRole: null };
    case 'followers': return { visibility: 'ORGANIZATION', minRole: null };
    case 'members': return { visibility: 'INVITE_ONLY', minRole: 'member' };
    case 'guides': return { visibility: 'INVITE_ONLY', minRole: 'guide' };
    case 'owners': return { visibility: 'INVITE_ONLY', minRole: 'owner' };
    case 'author': return { visibility: 'INVITE_ONLY', minRole: null };
  }
}

export function storageToAudience(visibility: string, minRole: string | null | undefined): Audience {
  if (visibility === 'PUBLIC') return 'everyone';
  if (visibility === 'ORGANIZATION') return 'followers';
  if (minRole === 'viewer') return 'followers';
  if (minRole === 'member') return 'members';
  if (minRole === 'guide') return 'guides';
  if (minRole === 'owner') return 'owners';
  return 'author';
}

export function isAudience(v: unknown): v is Audience {
  return typeof v === 'string' && AUDIENCES.some((a) => a.value === v);
}

export interface ThreadAccessSubject {
  visibility: string;
  minRole?: string | null;
  authorId: string;
  status: string;
}

export interface ThreadAccessViewer {
  userId: string | null;
  /** This viewer's role in the thread's org, or null. */
  role: ThreadRole | null;
  isGlobalAdmin?: boolean;
}

/** Whether `role` meets a thread's minimum role. A null minimum is met by any role. */
export function meetsMinRole(role: ThreadRole | null, minRole: string | null | undefined): boolean {
  if (!minRole) return true;
  if (!role) return false;
  const need = RANK[minRole as ThreadRole];
  return need !== undefined && RANK[role] >= need;
}

/**
 * Read check for one thread. Unpublished threads are for the author and the
 * org's editors (guides and owners), and a minimum role still applies to them.
 */
export function canViewThread(t: ThreadAccessSubject, v: ThreadAccessViewer): boolean {
  if (v.isGlobalAdmin) return true;
  if (v.userId && v.userId === t.authorId) return true;
  const editor = v.role === 'guide' || v.role === 'owner';
  if (t.status !== 'published') return editor && meetsMinRole(v.role, t.minRole);
  switch (t.visibility) {
    case 'PUBLIC': return true;
    case 'ORGANIZATION': return v.role !== null;
    case 'INVITE_ONLY': return Boolean(t.minRole) && meetsMinRole(v.role, t.minRole);
    default: return false;
  }
}
