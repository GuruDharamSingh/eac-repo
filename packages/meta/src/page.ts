/**
 * Posting to a Facebook Page.
 *
 * Two shapes cover what this network publishes:
 *
 *   a link post   message + link. Facebook scrapes the URL for its own card,
 *                 so the thread's OpenGraph tags are what readers see — the
 *                 API cannot override the title, image or description, and has
 *                 not been able to since 2017. If the card looks wrong, the
 *                 fix is in the page's <head>, not here.
 *   a photo post  an image Facebook fetches by URL, with a caption. Use it
 *                 when the image IS the post; use a link post when the point
 *                 is to send people to the thread.
 *
 * Both return the created post id, and the caller is expected to store it.
 * Without it there is no way to edit or delete what was posted, and a thread
 * deleted on this platform leaves its Facebook copy standing forever.
 */

import { graph, GraphError } from './client';
import type { PageTarget } from './config';

export interface PagePostResult {
  /** `<page-id>_<post-id>`. The addressable id for edit and delete. */
  postId: string;
  /** Permalink, when the response carries enough to build one. */
  url: string;
}

function permalink(postId: string): string {
  // Graph returns `<page>_<post>`; the web permalink wants them as a path.
  const [pageId, storyId] = postId.split('_');
  return storyId
    ? `https://www.facebook.com/${pageId}/posts/${storyId}`
    : `https://www.facebook.com/${postId}`;
}

/**
 * Post a link with a message.
 *
 * `scheduledAt` (unix seconds) publishes later; Facebook requires it to be
 * between 10 minutes and 6 months out and rejects anything else, so a caller
 * passing a thread's own `scheduled_at` should expect that validation to be
 * Meta's rather than ours.
 */
export async function postLinkToPage(
  target: PageTarget,
  input: { message: string; link: string; scheduledAt?: number },
  appSecret?: string
): Promise<PagePostResult> {
  const scheduled = input.scheduledAt
    ? { published: false, scheduled_publish_time: input.scheduledAt }
    : {};

  const result = await graph<{ id: string }>({
    path: `${target.pageId}/feed`,
    accessToken: target.accessToken,
    method: 'POST',
    params: { message: input.message, link: input.link, ...scheduled },
    appSecret,
  });

  return { postId: result.id, url: permalink(result.id) };
}

/**
 * Post a photo by URL.
 *
 * Facebook fetches `imageUrl` from its own servers, so it must be reachable
 * from the public internet without a session — a localhost URL, or a path
 * under an org's Private/ tree, fails with an error about the image rather
 * than about authorization, which is a confusing way to learn that.
 */
export async function postPhotoToPage(
  target: PageTarget,
  input: { imageUrl: string; caption?: string; scheduledAt?: number },
  appSecret?: string
): Promise<PagePostResult> {
  const scheduled = input.scheduledAt
    ? { published: false, scheduled_publish_time: input.scheduledAt }
    : {};

  const result = await graph<{ id: string; post_id?: string }>({
    path: `${target.pageId}/photos`,
    accessToken: target.accessToken,
    method: 'POST',
    params: { url: input.imageUrl, caption: input.caption, ...scheduled },
    appSecret,
  });

  // /photos returns the PHOTO id; post_id is the story. Prefer the story,
  // because that is what deleting and linking operate on.
  const postId = result.post_id ?? result.id;
  return { postId, url: permalink(postId) };
}

/**
 * Edit a published post's message.
 *
 * Only the message. Facebook does not allow changing a post's link or photo
 * after publication, so a thread whose media changed has to be deleted and
 * reposted — losing its reactions and comments. Worth surfacing to an author
 * before they hit save rather than after.
 */
export async function updatePagePost(
  postId: string,
  message: string,
  accessToken: string,
  appSecret?: string
): Promise<void> {
  await graph({
    path: postId,
    accessToken,
    method: 'POST',
    params: { message },
    appSecret,
  });
}

/**
 * Delete a post.
 *
 * Returns false when the post is already gone rather than throwing: a thread
 * deleted here after someone deleted the Facebook copy by hand is the normal
 * case, and it should not fail the thread's own deletion.
 */
export async function deletePagePost(
  postId: string,
  accessToken: string,
  appSecret?: string
): Promise<boolean> {
  try {
    await graph({ path: postId, accessToken, method: 'DELETE', appSecret });
    return true;
  } catch (err) {
    if (err instanceof GraphError && err.code === 100) return false;
    throw err;
  }
}
