import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { CATALOGUE } from "./catalogue";
import { BLOCK_DATA_IDS, loadBlockData } from "./data";

// ============================================================================
// The catalogue as a PUBLISHED page sees it.
//
// Resolvers read the database directly, for the org named in the metadata
// `resolveAllData` is called with — never a fixed org: this app renders every
// org's subdomain. Importing this module pulls @elkdonis/db in; it must never
// be reachable from a client component.
// ============================================================================

const serverResolvers: BlockResolvers = Object.fromEntries(
  BLOCK_DATA_IDS.map((id) => [
    id,
    async (props: Record<string, unknown>, metadata: Record<string, unknown>) => {
      const orgId = typeof metadata.orgId === "string" ? metadata.orgId : null;
      if (!orgId) return {};
      return loadBlockData(id, orgId, props);
    },
  ])
);

export const serverPuckConfig = buildPuckConfig({ resolvers: serverResolvers, blocks: CATALOGUE });

/** Every block the catalogue knows, so a stale saved page can be reported. */
export const KNOWN_TYPES = new Set(Object.keys(serverPuckConfig.components));
