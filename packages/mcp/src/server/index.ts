// Server entry: the MCP endpoint and its parts. Imports the database and
// services; never import it from a client component.
export { mcpHandler } from './handler';
export { dbGrantStore, memoryGrantStore, mintGrant, revokeGrant, hashKey, newKey, bearerKey, MCP_KEY_PREFIX, type GrantStore, type McpGrant, type McpScope, type MintInput } from './grants';
export { dbAudit, memoryAudit, type AuditRow, type AuditSink } from './audit';
export { settleOrg, settleChannel, managedOrgs, orgIdOf, boundOrg } from './org';
export { plain, platformHref, platformHosts, UNTRUSTED_NOTICE } from './sanitize';
export type { McpContent, McpContentItem, McpHostOptions, McpLms, McpPages, McpDrafts, McpDraft, McpDraftStepResult, DraftContract } from './types';
export { manifest, buildManifest, type ManifestBlock } from '../manifest';
