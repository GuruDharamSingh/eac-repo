"use client";

import type { Data } from "@puckeditor/core";
import { PuckEditor } from "@elkdonis/page-builder";
import { siteConfig } from "@/config/site";
import { puckConfig } from "@/lib/puck/config.client";
import { savePageAction } from "@/lib/puck/actions";

/**
 * The editor, with this site's catalogue and this site's save action bound to
 * it. Thin on purpose — everything that could be shared is in the package.
 */
export function PageEditor({ slug, initial }: { slug: string; initial: Data }) {
  return (
    <PuckEditor
      slug={slug}
      initial={initial}
      config={puckConfig}
      orgId={siteConfig.orgId}
      onPublish={savePageAction}
    />
  );
}
