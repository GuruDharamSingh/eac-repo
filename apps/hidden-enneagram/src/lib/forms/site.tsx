"use client";

import * as React from "react";
import type { SiteFormSite } from "@elkdonis/site-forms";
import { serviceActions, sitePostActions } from "@elkdonis/studio-forms";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { siteConfig } from "@/config/site";
import { studioHref } from "@/components/publish/studio-surface";
import {
  sitePostContextAction,
  sitePostListAction,
  sitePostLoadAction,
  sitePostSaveAction,
  siteServiceContextAction,
  siteServiceListAction,
  siteServiceLoadAction,
  siteServiceSaveAction,
} from "@/lib/forms/actions";

/** The actions of both kinds, shared by the popup, the page host and the /publish Offerings kind. */
export const heServiceActions = serviceActions({
  context: siteServiceContextAction,
  loadService: siteServiceLoadAction,
  saveService: siteServiceSaveAction,
  listServices: siteServiceListAction,
});

/**
 * hidden-enneagram's binding for the shared forms (@elkdonis/site-forms): the popup
 * (components/hub/HubSurfaces.tsx, `compose:service` and `compose:article`) and the page host
 * (components/manage/site-form-page.tsx). "More options in Studio" is this site's own /publish (its
 * StudioShell), not the network Studio. No meeting or event: this site does not offer them.
 */
export function heSiteForms(feeds: Array<{ slug: string; name: string }>): SiteFormSite {
  return {
    orgId: siteConfig.orgId,
    orgName: siteConfig.orgName,
    timeZone: siteConfig.timeZone,
    feeds,
    studioHref: (o) => studioHref({ kind: o.kind === "service" ? "service" : "writing", id: o.id }),
    slots: {
      media: ({ value, onChange, label, hint, accept }) => (
        <MediaPicker
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          uploadEndpoint="/api/upload"
          libraryEndpoint="/api/media/library"
          label={label ?? "Image"}
          hint={hint}
          accept={accept}
        />
      ),
      body: ({ value, onChange, tier }) => <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />,
    },
    kinds: {
      service: { actions: heServiceActions },
      post: {
        actions: sitePostActions({
          context: sitePostContextAction,
          loadPost: sitePostLoadAction,
          savePost: sitePostSaveAction,
          listPosts: sitePostListAction,
        }),
      },
    },
  };
}
