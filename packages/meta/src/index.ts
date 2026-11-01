/**
 * @elkdonis/meta — the network's Facebook/Instagram Graph API client.
 *
 * SERVER ONLY. Every export here handles a credential that can post as the
 * Page; none of it may reach a client bundle.
 */

export { GRAPH_VERSION, GRAPH_BASE, appFromEnv, pageFromEnv, isMetaConfigured } from './config';
export type { MetaAppConfig, PageTarget } from './config';

export { graph, GraphError, appSecretProof } from './client';
export type { GraphRequest, GraphErrorBody } from './client';

export {
  exchangeForLongLivedUserToken,
  listPages,
  getLinkedInstagramAccount,
  mintPageTokens,
  debugToken,
} from './tokens';
export type { PageGrant, TokenInfo } from './tokens';

export { postLinkToPage, postPhotoToPage, postToPage, updatePagePost, deletePagePost } from './page';
export type { PagePostResult } from './page';

export { postImageToInstagram, remainingInstagramQuota } from './instagram';
export type { InstagramPostResult } from './instagram';

export { parseSignedRequest } from './signed-request';
export type { SignedRequestPayload } from './signed-request';
export { createDataDeletionCallback } from './data-deletion';
export type { DeletionCallbackOptions } from './data-deletion';

export {
  THREADS_SCOPES,
  threadsAuthorizeUrl,
  threadsExchangeCode,
  threadsLongLivedToken,
  threadsRefreshToken,
  threadsMe,
  postToThreads,
} from './threads';
export type { ThreadsPostResult } from './threads';

export { postImageWithInstagramLogin } from './instagram-login';

// Webhooks (2026-10-31): the dashboard handshake and signed deliveries.
export { createWebhookHandlers, verifyHubSignature } from './webhook';
export type { WebhookEvent, WebhookOptions } from './webhook';
