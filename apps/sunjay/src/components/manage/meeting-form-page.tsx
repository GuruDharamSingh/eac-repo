"use client";

import * as React from "react";
import { SiteFormPage } from "@elkdonis/site-forms";
import { sunjaySiteForms } from "@/lib/forms/site";

/**
 * The shared form on /manage/content/new?kind=meeting|event|post and /manage/content/<id> (2026-11-14).
 * Named for the meeting pilot; `kind` picks the form (default meeting).
 */
export function MeetingFormPage({
  feeds,
  threadId,
  kind = "meeting",
}: {
  feeds: Array<{ slug: string; name: string }>;
  threadId?: string;
  kind?: "meeting" | "event" | "post";
}) {
  const site = React.useMemo(() => sunjaySiteForms(feeds), [feeds]);
  return <SiteFormPage kind={kind} site={site} threadId={threadId ?? null} closeHref="/manage" />;
}
