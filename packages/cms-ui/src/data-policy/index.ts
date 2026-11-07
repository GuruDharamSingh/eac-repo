// ============================================================================
// @elkdonis/cms-ui/data-policy — the data policy and deletion pages shared by
// the network's sites (2026-10-29).
//
//   import "@elkdonis/cms-ui/data-policy.css";
//   import { DataPolicy, DeletionRequestForm, DeletionStatus } from "@elkdonis/cms-ui/data-policy";
//
// A host renders <DataPolicy> at /data, and at /data/delete either
// <DeletionStatus> (when ?code= names a request) or the instructions with
// <DeletionRequestForm>. The form posts to /api/data/delete
// (createDeletionRequestHandler in @elkdonis/services); Meta's callback is
// createDataDeletionCallback in @elkdonis/meta.
// ============================================================================

export { DataPolicy } from "./DataPolicy";
export type { DataPolicyProps } from "./DataPolicy";
export { DeletionRequestForm } from "./DeletionRequestForm";
export { DeletionStatus } from "./DeletionStatus";
export type { DeletionStatusRequest } from "./DeletionStatus";
export { Terms, type TermsProps } from "./Terms";
