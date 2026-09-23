"use client";

import {
  EmailSurface,
  type EmailSuiteData,
  type EmailTab,
} from "@elkdonis/cms-ui/email";
import { useEmailConnectors } from "./use-email-connectors";

/**
 * The suite as a page. A thin client boundary over the shared surface: the
 * server page loads, this supplies the connectors, and the same component the
 * hub's popup renders draws the body.
 *
 * `asPage` drops the popup's masthead and its ✕, which on a page would sit
 * under the page's own heading with nothing to close.
 */
export function EmailSuiteHost({
  data,
  canEdit,
  tab,
}: {
  data: EmailSuiteData;
  canEdit: boolean;
  tab?: EmailTab;
}) {
  const connectors = useEmailConnectors();
  return (
    <EmailSurface data={data} connectors={connectors} canEdit={canEdit} tab={tab} asPage />
  );
}
