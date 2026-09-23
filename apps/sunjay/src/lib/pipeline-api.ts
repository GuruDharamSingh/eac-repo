import { createPipelineApi } from "@elkdonis/pipeline/routes";
import { getApiEditor, getApiMember, type Viewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * This site's pipeline API, bound to its org.
 *
 * The auth wrappers, the OrgDeckScopeError → 404 translation and the small
 * request helpers live in @elkdonis/pipeline/routes; this file only says which
 * org and which auth probes. It was ~55 lines duplicated verbatim in two apps.
 */
const api = createPipelineApi<Viewer>({
  orgId: siteConfig.orgId,
  getMember: getApiMember,
  getEditor: getApiEditor,
  logLabel: "sunjay",
});

export const { orgId, withMember, withEditor, num, badRequest } = api;
