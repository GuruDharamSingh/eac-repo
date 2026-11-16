import { uploadRoutes } from '@elkdonis/services';
import { getApiEditor } from '@/lib/auth';
import { siteConfig } from '@/config/site';

/**
 * Owner/guide upload into the org media tree. The logic is
 * `uploadRoutes` (packages/services/src/upload-routes.ts), kind `site`:
 * sniffed type, counted-byte caps, SVG refused, library row via
 * `registerLibraryItem`. This file keeps the old URL and response shape.
 */
export const dynamic = 'force-dynamic';

export const { POST } = uploadRoutes({
  orgId: siteConfig.orgId,
  who: async () => {
    const editor = await getApiEditor();
    return editor ? { userId: editor.userId, canEdit: true } : null;
  },
  kinds: ['site'],
  defaultKind: 'site',
  unauthorized: { status: 401, error: 'Unauthorized' },
  respond: (r) => ({
    success: true,
    id: r.id,
    fileId: r.name,
    url: r.url,
    path: r.path,
    filename: r.filename,
    mimeType: r.mimeType,
    size: r.size,
    mediaType: r.mediaType,
  }),
});
