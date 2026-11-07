"use client";

import * as React from "react";
import { SurfaceFrame, useSurface, defaultThreadToAnswers, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import type { ComposeContext } from "@elkdonis/cms-ui/compose";
import { createThreadAction } from "@/lib/cms/actions";
import type { ThreadFormInput } from "@/lib/cms/schema";
import { QuestionnaireComposer } from "@/components/cms/questionnaire-composer";

/**
 * Composing for one org from any surface stack on this host: the org console
 * (OrgConsoleHost) and a course step on /learn (LearnHost) open the same
 * composer, against the same per-org write path (`createThreadAction`, which
 * checks the person's role in the org named by `orgSlug`). Moved out of
 * OrgConsoleHost unchanged on 2026-11-06 for the action layer's phase 2
 * (docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md).
 */
export interface OrgComposeInput {
  orgSlug: string;
  /** The org's public site, for the "see it" link after saving. */
  orgHomeUrl: string;
  feeds: Array<{ slug: string; name: string }>;
  canEdit: boolean;
}

export function orgComposeContext({ orgSlug, feeds, canEdit }: Pick<OrgComposeInput, "orgSlug" | "feeds" | "canEdit">): ComposeContext {
  return {
    orgSlug,
    feeds,
    canManageOrg: canEdit,
    // This app is the network hub: cross-posting is the point of it, and
    // Talk rooms are already wired here (see /api/talk/join).
    canShareToNetwork: true,
    hasMeetings: true,
    // The workshop wizard is a route, not a sheet body — the catalogue says
    // so and ComposeFace honours it by navigating rather than opening an
    // empty dialog over it.
    hasWorkshops: true,
    canCreateTalkRoom: true,
  };
}

/** The createHubConnectors options that make compose work for one org. */
export function orgComposeConnectors({ orgSlug, orgHomeUrl, compose }: { orgSlug: string; orgHomeUrl: string; compose: ComposeContext }): Pick<
  SurfaceConnectors,
  "identities" | "compose" | "composeSlots" | "saveThread" | "threadToAnswers"
> & { customCompose: NonNullable<SurfaceConnectors["custom"]> } {
  return {
    // The names this person writes under. Scoped to the signed-in account
    // by the route itself, so nothing here identifies whose a name is.
    identities: {
      list: async () => {
        const res = await fetch("/api/hub/identities", { cache: "no-store" });
        if (!res.ok) throw new Error("identities");
        const data = await res.json();
        return data.identities ?? [];
      },
      create: async (input) => {
        const res = await fetch("/api/hub/identities", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false as const, error: data.error ?? "Could not open that name." };
        return { ok: true as const, identity: data.identity };
      },
      setRetired: async (identityId, retired) => {
        const res = await fetch("/api/hub/identities", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identityId, retired }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false as const, error: data.error ?? "Could not change that name." };
        return { ok: true as const };
      },
    },

    compose,

    composeSlots: {
      body: ({ value, onChange, tier }) => (
        <RichTextEditor
          value={value}
          onChange={onChange}
          toolbar={tier === "quick" ? "compact" : "full"}
        />
      ),
      // Never a URL box: upload, or choose from what this org already has.
      media: ({ value, onChange, label, hint, accept }) => (
        <MediaPicker
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          uploadEndpoint="/api/upload/image"
          libraryEndpoint="/api/media/library"
          label={label ?? "Image"}
          hint={hint}
          accept={accept}
        />
      ),
    },

    async saveThread({ kind, answers, status, actingAs }) {
      // Cast to one open shape: `CreateThreadResult` is a discriminated
      // union and this repo compiles with `strict: false`, where TS will
      // not narrow one — reading `.error` off the union is an error
      // without it. Same trap as PublishDraftResult.
      const result = (await createThreadAction(
        {
          ...answers,
          orgSlug,
          kind,
          status,
        } as unknown as ThreadFormInput,
        { actingAs }
      )) as {
        ok: boolean;
        id?: string;
        slug?: string;
        error?: string;
      };
      if (!result.ok || !result.id) {
        return { ok: false, error: result.error ?? "Could not save it" };
      }
      // The thread lives on the ORG'S site, not on this console, so the
      // "see it" link the surface offers has to point there.
      return {
        ok: true,
        id: result.id,
        href: result.slug ? `${orgHomeUrl}/${result.slug}` : null,
      };
    },

    threadToAnswers(thread) {
      return { ...defaultThreadToAnswers(thread), kind: thread.kind };
    },

    customCompose: {
      // Questionnaires and polls do NOT write to `threads` — they have
      // their own table and their own save path — so the compose surface
      // deliberately hides them unless the host registers a surface under
      // this exact key. Without these two the picker would silently drop
      // both kinds, which is what happened to the row this replaced.
      "compose:questionnaire": () => <ComposeQuestionnaire orgSlug={orgSlug} kind="questionnaire" />,
      "compose:poll": () => <ComposeQuestionnaire orgSlug={orgSlug} kind="poll" />,
    },
  };
}

/**
 * The questionnaire/poll composer, wearing a surface.
 *
 * `QuestionnaireComposer` is this app's own form against its own table; all
 * this adds is the shared frame so it looks like every other popup, and a
 * close that pops the layer rather than navigating.
 */
export function ComposeQuestionnaire({
  orgSlug,
  kind,
}: {
  orgSlug: string;
  kind: "questionnaire" | "poll";
}) {
  const surface = useSurface();
  return (
    <SurfaceFrame
      kind={kind}
      title={kind === "poll" ? "New poll" : "New questionnaire"}
      kicker={orgSlug}
    >
      <QuestionnaireComposer
        orgSlug={orgSlug}
        kind={kind}
        onDone={() => surface.close()}
      />
    </SurfaceFrame>
  );
}
