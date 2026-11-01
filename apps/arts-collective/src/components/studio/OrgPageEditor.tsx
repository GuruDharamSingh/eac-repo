"use client";

import { useMemo } from "react";
import type { Data } from "@puckeditor/core";
import { PuckEditor, templatesPlugin } from "@elkdonis/page-builder";
import type { PageTemplate } from "@elkdonis/blocks";
import { editorConfigFor } from "@/lib/puck/config.client";
import { saveOrgHomeAction } from "@/lib/puck/actions";
import { HOME_SLUG } from "@/lib/puck/home-slug";

/**
 * The editor, bound to one org: its catalogue, its media endpoints, its save
 * action. The org comes from the server page (the URL), never from a site
 * constant — this app hosts every org's console.
 */
export function OrgPageEditor({
  orgId,
  orgSlug,
  orgName,
  initial,
  templates,
}: {
  orgId: string;
  orgSlug: string;
  orgName: string;
  initial: Data;
  templates: PageTemplate[];
}) {
  const config = useMemo(() => editorConfigFor(orgSlug), [orgSlug]);
  const plugins = useMemo(() => [templatesPlugin(templates)], [templates]);
  return (
    <PuckEditor
      slug={HOME_SLUG}
      initial={initial}
      config={config}
      orgId={orgId}
      metadata={{ orgSlug }}
      onPublish={(_slug, data) => saveOrgHomeAction(orgSlug, data)}
      plugins={plugins}
      title={`${orgName} — landing page`}
    />
  );
}
