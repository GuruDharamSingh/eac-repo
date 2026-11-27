/**
 * Comments on posts the network published (2026-11-24): read them, reply to
 * them. Three routes, one per way a post went out:
 *
 *   - Facebook Page post: graph.facebook.com, Page token.
 *     Read needs pages_read_engagement + pages_read_user_content;
 *     reply (as the Page) needs pages_manage_engagement.
 *   - Instagram through a Page: graph.facebook.com, Page token.
 *     Read and reply need instagram_manage_comments.
 *   - Instagram Login: graph.instagram.com, Instagram user token.
 *     Read and reply need instagram_business_manage_comments.
 *
 * One page of results only (limit 100, replies nested): enough for the
 * Channel inbox; `complete` says whether more existed.
 */

import { graph } from './client';

const IG_LOGIN_API = 'https://graph.instagram.com/v21.0';

export interface PlatformComment {
  id: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string;
  message: string;
  createdAt: string | null;
  url: string | null;
}

export interface CommentPage {
  comments: PlatformComment[];
  /** False when Graph reported further pages that were not fetched. */
  complete: boolean;
}

interface FbComment {
  id: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
  parent?: { id?: string };
  permalink_url?: string;
}

/** Every comment on a Page post, replies included (filter=stream), oldest first. */
export async function listPagePostComments(postId: string, pageToken: string, appSecret?: string): Promise<CommentPage> {
  const r = await graph<{ data?: FbComment[]; paging?: { next?: string } }>({
    path: `${postId}/comments`,
    accessToken: pageToken,
    appSecret,
    params: {
      filter: 'stream',
      order: 'chronological',
      limit: 100,
      fields: 'id,message,created_time,from{id,name},parent{id},permalink_url',
    },
  });
  return {
    comments: (r.data ?? []).map((c) => ({
      id: c.id,
      parentId: c.parent?.id ?? null,
      authorId: c.from?.id ?? null,
      authorName: c.from?.name ?? '',
      message: c.message ?? '',
      createdAt: c.created_time ?? null,
      url: c.permalink_url ?? `https://www.facebook.com/${c.id}`,
    })),
    complete: !r.paging?.next,
  };
}

/** Reply as the Page under a comment. Returns the new comment's id. */
export async function replyToPageComment(commentId: string, message: string, pageToken: string, appSecret?: string): Promise<string> {
  const r = await graph<{ id: string }>({
    path: `${commentId}/comments`,
    method: 'POST',
    accessToken: pageToken,
    appSecret,
    params: { message },
  });
  return r.id;
}

interface IgComment {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
  from?: { id?: string; username?: string };
  replies?: { data?: IgComment[] };
}

function flattenIg(top: IgComment[]): PlatformComment[] {
  const out: PlatformComment[] = [];
  const one = (c: IgComment, parentId: string | null) => {
    const name = c.from?.username ?? c.username ?? '';
    out.push({ id: c.id, parentId, authorId: c.from?.id ?? null, authorName: name ? `@${name}` : '', message: c.text ?? '', createdAt: c.timestamp ?? null, url: null });
  };
  for (const c of top) {
    one(c, null);
    for (const r of c.replies?.data ?? []) one(r, c.id);
  }
  return out;
}

const IG_FIELDS = 'id,text,timestamp,username,from{id,username},replies{id,text,timestamp,username,from{id,username}}';

/** Comments on an Instagram media item posted through a Page (Facebook Login). */
export async function listInstagramComments(mediaId: string, pageToken: string, appSecret?: string): Promise<CommentPage> {
  const r = await graph<{ data?: IgComment[]; paging?: { next?: string } }>({
    path: `${mediaId}/comments`,
    accessToken: pageToken,
    appSecret,
    params: { limit: 100, fields: IG_FIELDS },
  });
  return { comments: flattenIg(r.data ?? []), complete: !r.paging?.next };
}

/** Reply under an Instagram comment through a Page (Facebook Login). */
export async function replyToInstagramComment(commentId: string, message: string, pageToken: string, appSecret?: string): Promise<string> {
  const r = await graph<{ id: string }>({
    path: `${commentId}/replies`,
    method: 'POST',
    accessToken: pageToken,
    appSecret,
    params: { message },
  });
  return r.id;
}

async function igLogin<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & Record<string, unknown>;
  if (!res.ok || data?.error) {
    const e = data?.error;
    throw new Error(`Instagram said: ${e?.message ?? res.status}${e?.code ? ` (code ${e.code})` : ''}`);
  }
  return data as T;
}

/** Comments on a media item posted with Instagram Login. */
export async function listInstagramLoginComments(mediaId: string, accessToken: string): Promise<CommentPage> {
  const q = new URLSearchParams({ limit: '100', fields: IG_FIELDS, access_token: accessToken });
  const r = await igLogin<{ data?: IgComment[]; paging?: { next?: string } }>(`${IG_LOGIN_API}/${mediaId}/comments?${q}`);
  return { comments: flattenIg(r.data ?? []), complete: !r.paging?.next };
}

/** Reply under a comment with Instagram Login. */
export async function replyToInstagramLoginComment(commentId: string, message: string, accessToken: string): Promise<string> {
  const r = await igLogin<{ id: string }>(`${IG_LOGIN_API}/${commentId}/replies`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, access_token: accessToken }),
  });
  return r.id;
}
