"use client";

import { EmailSurface, type EmailSuiteData } from "@elkdonis/cms-ui/email";
import { useEmailConnectors } from "@/components/hub/email/use-email-connectors";

/**
 * One series' letters: the shared suite with the Letters tab only, over the
 * series-scoped connectors (`?series=<id>&purpose=<p>` on every call).
 */
export function SeriesLettersHost({ data, seriesId }: { data: EmailSuiteData; seriesId: string }) {
  const connectors = useEmailConnectors({ seriesId });
  return (
    <EmailSurface
      data={data}
      connectors={connectors}
      canEdit
      tab="letters"
      tabs={["letters"]}
      asPage
    />
  );
}
