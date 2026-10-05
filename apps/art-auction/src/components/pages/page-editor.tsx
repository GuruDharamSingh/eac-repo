"use client";

import { useMemo } from "react";
import type { Data } from "@puckeditor/core";
import { PuckEditor, templatesPlugin } from "@elkdonis/page-builder";
import type { PageTemplate } from "@elkdonis/blocks";
import { puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";

/** The editor with this site's catalogue, templates and save action bound. */
export function PageEditor({
  slug,
  orgId,
  initial,
  templates,
}: {
  slug: string;
  orgId: string;
  initial: Data;
  templates: PageTemplate[];
}) {
  const plugins = useMemo(() => [templatesPlugin(templates)], [templates]);
  return (
    <PuckEditor
      slug={slug}
      initial={initial}
      config={puckConfig}
      orgId={orgId}
      onPublish={savePageAction}
      plugins={plugins}
      title={slug === "article-detail" ? "Article page template" : `/${slug}`}
    />
  );
}
