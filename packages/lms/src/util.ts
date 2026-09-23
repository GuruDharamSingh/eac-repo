import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import type { LmsViewer } from './types';

export const newId = () => nanoid();

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function plainText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashContent(parts: unknown): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

const STAFF_ROLES = new Set(['owner', 'guide']);
/** Org owners and guides (stewards included — see getViewerRoles) run the org's courses. */
export function isOrgStaff(viewer: LmsViewer, orgId: string): boolean {
  return Boolean(viewer.isGlobalAdmin) || STAFF_ROLES.has(viewer.roles[orgId] ?? '');
}

/** Routes the package owns under a course; a step may not take these slugs. */
export const RESERVED_STEP_SLUGS = new Set(['guide', 'journal', 'circle', 'begin', 'run', 'runs', 'edit']);
/** Routes the host owns at the root; a course may not take these slugs. */
export const RESERVED_COURSE_SLUGS = new Set(['api', 'login', 'journal', 'guide', 'about', 'care', 'sitemap.xml', 'robots.txt', '_next', 'studio']);
