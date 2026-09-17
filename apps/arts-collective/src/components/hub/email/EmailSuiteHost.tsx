"use client";

import {
  EmailSurface,
  type EmailSuiteData,
  type EmailTab,
} from "@elkdonis/cms-ui/email";
import { useEmailConnectors } from "./use-email-connectors";

/**
 * The suite as a page.
 *
 * A thin client boundary over the shared surface: the server page loads, this
 * supplies the connectors, and the same `EmailSurface` the popup renders draws
 * the body. `asPage` drops the popup's own action bar, which would otherwise
 * offer a "Go to the email suite" button on the email suite.
 */
export function EmailSuiteHost({
  orgSlug,
  data,
  canEdit,
  tab,
}: {
  orgSlug: string;
  data: EmailSuiteData;
  canEdit: boolean;
  tab?: EmailTab;
}) {
  const connectors = useEmailConnectors(orgSlug);
  return (
    <EmailSurface data={data} connectors={connectors} canEdit={canEdit} tab={tab} asPage />
  );
}
