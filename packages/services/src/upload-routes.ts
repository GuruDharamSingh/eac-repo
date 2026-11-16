/**
 * The upload route handler as one factory (2026-11-16), the way `centerRoutes`
 * carries the connections routes: services owns the handler, the app passes
 * who the viewer is.
 *
 *   // apps/<app>/src/app/api/center/avatar/route.ts
 *   export const dynamic = "force-dynamic";
 *   export const { POST } = uploadRoutes({
 *     orgId: siteConfig.orgId,
 *     who: async () => { const v = await getViewer(); return v ? { userId: v.userId } : null; },
 *     kinds: ["avatar"],
 *     defaultKind: "avatar",
 *   });
 *
 * The form carries `file`, and (unless `defaultKind` fixes it) `kind`.
 * Org-scoped avatars: send `scope=org`; the org is the site's own `orgId` (or
 * what `resolveOrg` returns). An `orgId` field in the form is NEVER read.
 */
import {
  maxUploadBytes,
  storeUpload,
  type MediaFolder,
  type Policy,
  type StoredUpload,
  type UploadIO,
  type UploadKind,
  type Visibility,
} from './uploads';

export interface UploadViewer {
  userId: string;
  /** owner/guide of the site's org (what the app already calls canEdit) */
  canEdit?: boolean;
}

export interface UploadCtx {
  kind: UploadKind;
  viewer: UploadViewer;
  form: FormData;
}

export interface UploadRoutesOptions {
  orgId?: string;
  who: () => Promise<UploadViewer | null>;
  kinds: UploadKind[];
  /** a legacy URL fixes the kind so no client change is needed */
  defaultKind?: UploadKind;
  /**
   * Extra gate per request. Return false to refuse (403), or `{ ownerUserId }` to
   * upload into another person's tree (personal / artwork only).
   * `site` needs viewer.canEdit unless this says otherwise; `artwork` and `forum`
   * REFUSE unless this is supplied and allows.
   */
  authorize?: (ctx: UploadCtx) => Promise<boolean | { ownerUserId?: string; orgId?: string }>;
  /** for `scope=org` when the site is not tied to one org (arts-collective) */
  resolveOrg?: (ctx: UploadCtx) => Promise<string | null>;
  narrow?: Partial<Record<UploadKind, Partial<Policy>>>;
  /** side effects that are not storage (portfolio append, markArtist) */
  onStored?: (result: StoredUpload, ctx: UploadCtx) => Promise<void>;
  /** tests only: replace storage and database access */
  io?: Partial<UploadIO>;
}

const FOLDERS = ['Images', 'Audio', 'Videos', 'Documents'];

export function uploadRoutes(opts: UploadRoutesOptions) {
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
    });
  const fail = (status: number, error: string) => json({ ok: false, error }, status);
  const field = (form: FormData, key: string) => {
    const v = form.get(key);
    return typeof v === 'string' ? v.trim() : '';
  };

  async function POST(request: Request): Promise<Response> {
    try {
      const viewer = await opts.who();
      if (!viewer) return fail(401, 'Sign in first');

      // Refuse a huge body before reading it. Slack covers multipart framing.
      const limit = maxUploadBytes(opts.kinds, opts.narrow) + 256 * 1024;
      const declared = Number(request.headers.get('content-length') ?? 0);
      if (declared > limit) return fail(413, 'That file is too large');

      const form = await request.formData().catch(() => null);
      if (!form) return fail(400, 'Expected a file upload');
      const file = form.get('file');
      if (!file || typeof file === 'string') return fail(400, 'No file provided');

      const requested = (opts.defaultKind ?? field(form, 'kind')) as UploadKind;
      if (!opts.kinds.includes(requested)) return fail(400, 'Unknown upload kind');
      const kind = requested;
      const ctx: UploadCtx = { kind, viewer, form };

      // Who may. The defaults are the narrowest that match today's routes.
      let ownerUserId: string | undefined;
      let orgId: string | undefined = opts.orgId;
      if (opts.authorize) {
        const verdict = await opts.authorize(ctx);
        if (!verdict) return fail(403, 'You are not allowed to upload here');
        if (typeof verdict === 'object') {
          ownerUserId = verdict.ownerUserId;
          if (verdict.orgId) orgId = verdict.orgId;
        }
      } else if (kind === 'artwork' || kind === 'forum') {
        return fail(403, 'You are not allowed to upload here');
      } else if (kind === 'site' && !viewer.canEdit) {
        return fail(403, 'Only the people who run this site can upload here');
      }

      if (kind === 'avatar') {
        // Network avatar by default; org-scoped only on request, org from the server side.
        if (field(form, 'scope') === 'org') {
          orgId = opts.resolveOrg ? ((await opts.resolveOrg(ctx)) ?? undefined) : opts.orgId;
          if (!orgId) return fail(400, 'No organisation for this upload');
        } else {
          orgId = undefined;
        }
        ownerUserId = undefined; // an avatar is always the viewer's own
      }

      const rawVis = field(form, 'visibility');
      const visibility: Visibility =
        rawVis === 'ORGANIZATION' || rawVis === 'INVITE_ONLY' ? rawVis : 'PUBLIC';
      const rawFolder = field(form, 'folder');
      const folder = FOLDERS.includes(rawFolder) ? (rawFolder as MediaFolder) : undefined;
      if (rawFolder && !folder) return fail(400, `folder must be one of ${FOLDERS.join(', ')}`);

      const bytes = new Uint8Array(await (file as File).arrayBuffer());
      const result = await storeUpload({
        kind,
        actor: { userId: viewer.userId },
        file: { name: (file as File).name || 'file', type: (file as File).type, bytes },
        orgId,
        ownerUserId,
        visibility,
        folder,
        gallery: field(form, 'gallery') || undefined,
        title: field(form, 'title').slice(0, 200) || undefined,
        narrow: opts.narrow?.[kind],
      }, opts.io);

      if ("status" in result) return fail(result.status, result.error);
      console.log(`[uploads] ${kind} ${viewer.userId} ${result.size}b ${result.mimeType}`);
      if (opts.onStored) await opts.onStored(result, ctx).catch((e) => console.error('[uploads] onStored:', e));
      return json({ ...result, success: true });
    } catch (error) {
      console.error('[uploads] route:', error);
      return fail(500, 'Upload failed');
    }
  }

  return { POST };
}
