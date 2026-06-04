import { NextResponse } from 'next/server';
import { getAdminClient } from '@elkdonis/nextcloud';

export const dynamic = 'force-dynamic';

const VIDEOS_PATH = 'EAC_Network/inner_group/Media/Videos/video playlist';

// Pre-encode the path for use in proxy URLs (encodes each segment, preserving slashes)
const VIDEOS_PROXY_PATH = VIDEOS_PATH.split('/')
  .map((s) => encodeURIComponent(s))
  .join('/');

export interface LiveVideo {
  name: string;
  proxyUrl: string;
  size: number;
  lastmod: string;
}

export async function GET() {
  try {
    const client = getAdminClient();
    const items = (await client.webdav.getDirectoryContents(VIDEOS_PATH)) as any[];

    console.log(`[Live Videos] Found ${items.length} items in ${VIDEOS_PATH}`);
    for (const item of items) {
      console.log(`[Live Videos]   - ${item.basename} (type: ${item.type}, mime: ${item.mime})`);
    }

    const videos: LiveVideo[] = items
      .filter((item: any) => item.type === 'file' && /\.(mp4|webm|mov)$/i.test(item.basename))
      .sort((a: any, b: any) => a.basename.localeCompare(b.basename))
      .map((item: any) => ({
        name: item.basename,
        proxyUrl: `/api/media/${VIDEOS_PROXY_PATH}/${encodeURIComponent(item.basename)}`,
        size: item.size || 0,
        lastmod: item.lastmod,
      }));

    console.log(`[Live Videos] ${videos.length} videos after filtering`);

    return NextResponse.json({ videos });
  } catch (err: any) {
    console.error('[Live Videos] Error fetching video list:', err?.message, err?.response?.status, err?.response?.data);
    return NextResponse.json({ videos: [] });
  }
}
