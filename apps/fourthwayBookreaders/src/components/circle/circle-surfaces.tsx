"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, SearchCheck } from "lucide-react";
import { SurfaceProvider, useSurface, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { createSessionThread } from "@/lib/circle-actions";
import { defineTermAction, lookupTermAction } from "@/lib/dictionary-actions";
import { withBase } from "@/lib/base-path";
import { siteConfig } from "@/config/site";

/**
 * The shared pop-up surfaces (@elkdonis/cms-ui/surface) for the circle page.
 *
 * Mounted on this page only, not the root layout: the rest of the site does
 * not use surfaces yet (see /hub's note). What it offers here:
 *
 *   thread   read a thread in a pop-up (GET /api/hub/threads/:id)
 *   compose  quick entry of a new thread; saved by createSessionThread into
 *            the circle's discussion and gathered onto the sitting's topic
 *   define   the network dictionary (lookup/define server actions)
 *
 * Which sitting a new thread belongs to is not a compose field, so the button
 * that opens compose records it here first and saveThread reads it back.
 */

interface SessionTarget {
  groupId: string;
  occurrenceAt: string;
}

const TargetContext = React.createContext<React.MutableRefObject<SessionTarget | null> | null>(null);

export function CircleSurfaces({
  signedIn,
  isMember,
  canEdit,
  displayName,
  feed,
  talkBaseUrl,
  children,
}: {
  signedIn: boolean;
  isMember: boolean;
  canEdit: boolean;
  displayName: string | null;
  feed: { slug: string; name: string } | null;
  talkBaseUrl: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const target = React.useRef<SessionTarget | null>(null);

  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      ...createHubConnectors({
        viewer: { signedIn, canCompose: isMember, displayName },
        orgName: siteConfig.orgName,
        timeZone: siteConfig.timeZone,
        talkBaseUrl,
        routes: {
          thread: withBase("/api/hub/threads"),
          rsvp: withBase("/api/threads"),
          upload: withBase("/api/upload"),
          mediaLibrary: withBase("/api/media/library"),
        },
        dictionary: isMember
          ? {
              lookup: (term) => lookupTermAction(term),
              define: (input) => defineTermAction(input),
            }
          : undefined,
        async saveThread({ answers, status }) {
          const t = target.current;
          if (!t) return { ok: false, error: "Open this from a session." };
          const result = await createSessionThread({
            groupId: t.groupId,
            occurrenceAt: t.occurrenceAt,
            title: String(answers.title ?? ""),
            body: String(answers.body ?? ""),
            status,
          });
          if ("error" in result) return { ok: false, error: result.error };
          return { ok: true, id: result.id, href: result.href };
        },
        compose: {
          orgSlug: siteConfig.orgId,
          feeds: feed ? [feed] : [],
          canManageOrg: canEdit,
          hasWorkshops: false,
          hasMeetings: false,
          canCreateDocument: false,
          canCreateTalkRoom: false,
          canShareToNetwork: false,
        },
        composeSlots: {
          body: ({ value, onChange, tier }) => (
            <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />
          ),
        },
        onMutated: () => router.refresh(),
      }),
    }),
    [signedIn, isMember, canEdit, displayName, feed, talkBaseUrl, router]
  );

  return (
    <TargetContext.Provider value={target}>
      <SurfaceProvider connectors={connectors} syncUrl={false}>{children}</SurfaceProvider>
    </TargetContext.Provider>
  );
}

/** "+ New thread" for one sitting: opens the compose pop-up for a post. */
export function NewSessionThreadButton({ groupId, occurrenceAt }: SessionTarget) {
  const surface = useSurface();
  const target = React.useContext(TargetContext);
  return (
    <button
      type="button"
      className="btn btn--small"
      onClick={() => {
        if (target) target.current = { groupId, occurrenceAt };
        surface.open({ type: "compose", kind: "post", tier: "quick" });
      }}
    >
      <MessageSquarePlus size={13} aria-hidden /> New thread
    </button>
  );
}

/** A thread title that opens the thread pop-up instead of navigating. */
export function OpenThreadButton({ id, children }: { id: string; children: React.ReactNode }) {
  const surface = useSurface();
  return (
    <button type="button" className="circle-linkbtn" onClick={() => surface.open({ type: "thread", id })}>
      {children}
    </button>
  );
}

/** Look a word up in the network dictionary (the define pop-up). */
export function DefineWord({ sourceThreadId }: { sourceThreadId?: string }) {
  const surface = useSurface();
  const [term, setTerm] = React.useState("");
  return (
    <form
      className="circle-define"
      onSubmit={(e) => {
        e.preventDefault();
        const t = term.trim();
        if (t) surface.open({ type: "define", term: t, sourceThreadId });
      }}
    >
      <label className="eyebrow" htmlFor="define-term">Define a word</label>
      <div className="circle-define__row">
        <input id="define-term" className="field" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. kesdjan" />
        <button className="btn btn--small" type="submit"><SearchCheck size={13} aria-hidden /> Define</button>
      </div>
    </form>
  );
}
