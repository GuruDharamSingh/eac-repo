import { parseThumbnailWidth } from './media-thumbnail';
import { serveMedia } from './media-serve';

// ============================================================================
// The `/api/media/[...path]` GET route, once.
//
// Seven apps carried this file as a copy: read the path, ask who is looking,
// call serveMedia with the network prefix, the range header and `?w=`. The
// copies differed only in how they find the viewer, so that is the one option
// that is required. Every app gets `?w=` by taking this, and a change to the
// route (a new query rule, a header) lands in one place.
//
//   // app/api/media/[...path]/route.ts
//   export const { GET } = mediaRoutes({
//     viewerId: async () => (await getViewer())?.userId ?? null,
//   });
//
// Takes a standard Request so this package needs no `next` dependency.
// ============================================================================

export interface MediaRoutesOptions {
  /** Who is asking. Null for anonymous. Apps resolve identity differently. */
  viewerId: () => Promise<string | null | undefined>;
  /** Default: the whole network tree. */
  allowedPrefixes?: string[];
}

export function mediaRoutes(opts: MediaRoutesOptions) {
  async function GET(
    request: Request,
    context: { params: Promise<{ path: string[] }> }
  ): Promise<Response> {
    const { path } = await context.params;
    const viewerId = (await opts.viewerId()) ?? null;
    const url = new URL(request.url);
    return serveMedia({
      filePath: path.join('/'),
      viewerId,
      allowedPrefixes: opts.allowedPrefixes ?? ['EAC_Network/'],
      range: request.headers.get('range'),
      width: parseThumbnailWidth(url.searchParams.get('w')),
    });
  }
  return { GET };
}
