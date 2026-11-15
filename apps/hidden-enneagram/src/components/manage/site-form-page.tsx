"use client";

import * as React from "react";
import { SiteFormPage } from "@elkdonis/site-forms";
import { heSiteForms } from "@/lib/forms/site";

export type SiteFormKind = "service" | "post";

/** The shared form for a kind on /manage/content/new?kind=<kind> and /manage/content/<id> (2026-11-14). */
export function SiteFormPageHost({ kind, feeds, threadId }: { kind: SiteFormKind; feeds: Array<{ slug: string; name: string }>; threadId?: string }) {
  const site = React.useMemo(() => heSiteForms(feeds), [feeds]);
  return <SiteFormPage kind={kind} site={site} threadId={threadId ?? null} closeHref="/manage" />;
}
