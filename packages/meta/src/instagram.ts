/**
 * Publishing to Instagram.
 *
 * Instagram is not "Facebook with a different id", and three of its rules
 * shape anything built on top of it:
 *
 *   1. Publishing is TWO calls. You create a media container, wait for
 *      Instagram to finish downloading and transcoding the file, and then
 *      publish the container. The first call returns before the media is
 *      ready, so publishing immediately fails intermittently — on a fast image
 *      it often works, which is exactly what makes it a bad bug later.
 *   2. There is no link in a post. A caption's URLs are not clickable, so
 *      "read the full piece at ..." is decoration. Whatever a post needs to
 *      say has to be said in the image and the caption.
 *   3. 25 published posts per rolling 24 hours, counted per account. A bulk
 *      backfill will hit it, and the error arrives as a generic rate limit.
 *
 * The account must be a Business or Creator account linked to the Page, and
 * the image must be JPEG reachable from the public internet. PNG is rejected —
 * quietly, as a container that never leaves the ERROR state — which is the
 * single most common cause of "it just doesn't post".
 */

import { graph, GraphError } from './client';
import type { PageTarget } from './config';

export interface InstagramPostResult {
  mediaId: string;
  url: string;
}

/** How long to wait for Instagram to ingest the media before giving up. */
const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

type ContainerStatus = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';

/**
 * Poll a container until Instagram has finished ingesting it.
 *
 * Throws on ERROR/EXPIRED rather than returning a flag, because there is
 * nothing a caller can do with a container in either state except report it.
 */
async function waitForContainer(
  containerId: string,
  accessToken: string,
  appSecret?: string
): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = await graph<{ status_code: ContainerStatus; status?: string }>({
      path: containerId,
      accessToken,
      params: { fields: 'status_code,status' },
      appSecret,
    });

    if (result.status_code === 'FINISHED') return;
    if (result.status_code === 'ERROR' || result.status_code === 'EXPIRED') {
      throw new Error(
        `Instagram could not ingest the media (${result.status_code}): ` +
          `${result.status ?? 'no detail'}. The usual cause is a non-JPEG image ` +
          `or a URL Instagram's servers cannot reach.`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Instagram did not finish ingesting the media within ${READY_TIMEOUT_MS / 1000}s. ` +
      `The container may still publish later; it was not published here.`
  );
}

/**
 * Post a single image with a caption.
 *
 * `imageUrl` must be a public JPEG. Instagram fetches it from its own servers,
 * so the same rule as Facebook photos applies and for the same reason: a
 * private or localhost URL fails as a media error, not an auth error.
 */
export async function postImageToInstagram(
  target: PageTarget,
  input: { imageUrl: string; caption?: string },
  appSecret?: string
): Promise<InstagramPostResult> {
  if (!target.instagramUserId) {
    throw new Error(
      'No Instagram account is linked to this Page. Link a Business or Creator ' +
        'account in Page settings and set META_INSTAGRAM_USER_ID.'
    );
  }

  const container = await graph<{ id: string }>({
    path: `${target.instagramUserId}/media`,
    accessToken: target.accessToken,
    method: 'POST',
    params: { image_url: input.imageUrl, caption: input.caption },
    appSecret,
  });

  await waitForContainer(container.id, target.accessToken, appSecret);

  const published = await graph<{ id: string }>({
    path: `${target.instagramUserId}/media_publish`,
    accessToken: target.accessToken,
    method: 'POST',
    params: { creation_id: container.id },
    appSecret,
  });

  const permalink = await getPermalink(published.id, target.accessToken, appSecret);
  return { mediaId: published.id, url: permalink };
}

/**
 * The post's public URL.
 *
 * Best-effort: a failure here means the post succeeded but we could not read
 * its permalink, and losing the post over a missing link would be the wrong
 * trade.
 */
async function getPermalink(
  mediaId: string,
  accessToken: string,
  appSecret?: string
): Promise<string> {
  try {
    const result = await graph<{ permalink?: string }>({
      path: mediaId,
      accessToken,
      params: { fields: 'permalink' },
      appSecret,
    });
    return result.permalink ?? `https://www.instagram.com/p/${mediaId}`;
  } catch {
    return `https://www.instagram.com/p/${mediaId}`;
  }
}

/**
 * How many of the day's 25 posts are left.
 *
 * Worth checking before a batch: the limit is enforced on publish, so without
 * this a backfill discovers it 25 posts in, with the rest failing as a rate
 * limit that looks like an app-level throttle.
 */
export async function remainingInstagramQuota(
  target: PageTarget,
  appSecret?: string
): Promise<number | null> {
  if (!target.instagramUserId) return null;
  try {
    const result = await graph<{ data?: Array<{ quota_usage: number; config?: { quota_total?: number } }> }>({
      path: `${target.instagramUserId}/content_publishing_limit`,
      accessToken: target.accessToken,
      params: { fields: 'quota_usage,config' },
      appSecret,
    });
    const row = result.data?.[0];
    if (!row) return null;
    return (row.config?.quota_total ?? 25) - row.quota_usage;
  } catch (err) {
    if (err instanceof GraphError) return null;
    throw err;
  }
}
