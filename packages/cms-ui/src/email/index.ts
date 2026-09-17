// ============================================================================
// @elkdonis/cms-ui/email — the email suite.
//
//   import "@elkdonis/cms-ui/email.css";
//   import { EmailFace, EmailSurface } from "@elkdonis/cms-ui/email";
//
// One face and one surface, serving both the hub popup and the full-page
// suite. Replaces four app-local attempts that each knew about one fifth of
// the problem: amrit-canada's per-thread EmailSurface, innergathering's
// /hub/email template gallery, hidden-enneagram's /manage/contacts, and the
// newsletter list beside it.
//
// Presentational only, like the rest of this package: data in, markup out,
// writes through connectors the host supplies.
// ============================================================================

export { EmailFace } from "./EmailFace";
export type { EmailFaceProps } from "./EmailFace";
export { EmailSurface, EmailCustomSurface } from "./EmailSurface";
export type { EmailSurfaceProps, EmailTab } from "./EmailSurface";
export type {
  EmailActivity,
  EmailAddress,
  EmailConnectors,
  EmailDeliveryStats,
  EmailDirection,
  EmailIdentitySummary,
  EmailMessage,
  EmailSuiteData,
  EmailTemplateSummary,
} from "./types";
