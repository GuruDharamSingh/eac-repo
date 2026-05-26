/**
 * @elkdonis/commerce — types, money utils, and re-exports.
 *
 * Sub-paths:
 *   - "@elkdonis/commerce/types"       (types only, safe to import client-side)
 *   - "@elkdonis/commerce/money"       (formatting + math, no DB)
 *   - "@elkdonis/commerce/components"  (React components — portable across apps)
 *   - "@elkdonis/commerce/queries"     (server-only DB reads)
 *   - "@elkdonis/commerce/server"      (server-only mutations)
 *   - "@elkdonis/commerce/etransfer"   (eTransfer instruction composer)
 */

export * from "./types";
export * from "./money";
