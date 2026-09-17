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

export { postLinkToPage, postPhotoToPage, updatePagePost, deletePagePost } from './page';
export type { PagePostResult } from './page';

export { postImageToInstagram, remainingInstagramQuota } from './instagram';
export type { InstagramPostResult } from './instagram';
