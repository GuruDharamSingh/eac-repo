export type {
  DossierProfileData,
  DossierOperation,
  DossierChannel,
  DossierTemplates,
} from "./types";

export { dossierFieldRegistry } from "./field-registry";
export type { DossierFieldMeta } from "./field-registry";

export {
  renderDossier,
  applyDossierTraits,
  buildDossierNav,
  buildDossierIdentity,
  buildOperationsHtml,
  buildIntelligenceHtml,
  buildNetworkHtml,
  buildFundsHtml,
} from "./render";
