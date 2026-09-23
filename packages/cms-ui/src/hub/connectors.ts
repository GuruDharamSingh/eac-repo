import type {
  SurfaceBoard,
  SurfaceDocument,
  SurfaceIdea,
  SurfaceCenterLayout,
  SurfaceConnectors,
  SurfaceProfile,
  SurfaceThread,
  SurfaceForumThread,
  SurfaceGathered,
  SurfaceGatherCandidate,
  SurfaceProfilePageConnectors,
  SurfacePresence,
  SurfacePostTarget,
} from "../surface";

// ============================================================================
// createHubConnectors — the parts of a host's SurfaceConnectors that are not
// actually about the host.
//
// amrit-canada and innergathering each carried a 338-line HubSurfaces.tsx of
// which ~160 lines were identical: loadThread, listEvents, listMedia, rsvp,
// the whole Nextcloud-Deck→SurfaceBoard translation, profile, and
// centerLayout. They had begun to drift — one grew a forum and a dictionary,
// the other workshops and an `accept` passthrough — which is what duplicated
// code does before it becomes two different products by accident.
//
// What stays with the host is what only the host knows: its own schema
// (`saveThread`), its editor and media widgets (`composeSlots`), and which
// capabilities it actually has. Everything else is defaulted here.
//
// ROUTES. The paths below are the ones both template apps already serve. A
// host on different paths overrides `routes` rather than reimplementing the
// function — but note the CONTRACT, not just the path: each is expected to
// answer the shapes the surfaces read, and to 404 rather than 403 on a thing
// the viewer may not see, so an unpublished item never confirms it exists.
// ============================================================================

export interface HubRoutes {
  /** GET `${thread}/:id` → SurfaceThread. 404/403 both mean "nothing". */
  thread: string;
  /** GET `${calendar}?from&to` → `{events}`. */
  calendar: string;
  /** GET → `{items:[{url,filename}]}`. */
  mediaLibrary: string;
  /** POST multipart. Handed to the surfaces as `uploadEndpoint`. */
  upload: string;
  /** GET/PATCH `${centerLayout}?org=` */
  centerLayout: string;
  /** GET/PATCH `${profile}` and `${profile}?org=` */
  profile: string;
  /** POST multipart → `{url}` */
  avatar: string;
  /** POST/DELETE `${rsvp}/:id/rsvp` */
  rsvp: string;
  /** GET `${pipeline}` plus `${pipeline}/cards*` */
  pipeline: string;
  /** The board's full drag-and-drop page. */
  pipelinePage: string;
  /** GET → the forum snapshot. */
  forumSnapshot: string;
  /** GET → `{documents}`; POST `{title?}` → `{document}`; PATCH `{documentId, ideaId}`;
   *  DELETE `?documentId=` → takes it off the list. */
  documents: string;
  /** GET → `{ideas}`; POST `{title}` → `{idea}`. */
  ideas: string;
  /** POST form-encoded; answers 303. */
  forumReadAll: string;
  /** GET → SurfacePresence; POST `{row,column,on}`. */
  presence: string;
  /** GET → `{targets}`; POST `{target,title,text}` → `{href,label}`. */
  postTo: string;
}

const DEFAULT_ROUTES: HubRoutes = {
  thread: "/api/hub/threads",
  calendar: "/api/hub/calendar",
  mediaLibrary: "/api/media/library",
  upload: "/api/upload",
  centerLayout: "/api/center/layout",
  profile: "/api/center/profile",
  avatar: "/api/center/avatar",
  rsvp: "/api/threads",
  pipeline: "/api/pipeline",
  pipelinePage: "/hub/pipeline",
  forumSnapshot: "/api/hub/forum",
  documents: "/api/hub/documents",
  ideas: "/api/hub/ideas",
  forumReadAll: "/api/forum/read-all",
  presence: "/api/center/presence",
  postTo: "/api/center/post",
};

/** The Deck card JSON the pipeline API returns, as far as the board reads it. */
interface DeckCardJson {
  id: number;
  stackId: number;
  title: string;
  description?: string | null;
  duedate?: string | null;
  done?: string | null;
  archived?: boolean;
  labels?: Array<{ id: number; title: string; color: string }> | null;
  assignedUsers?: Array<{ participant?: { uid?: string; displayname?: string } }> | null;
  commentsCount?: number;
  attachmentCount?: number;
}

/** What only the host can answer. */
type HostSupplied = Pick<SurfaceConnectors, "viewer" | "orgName"> &
  Partial<
    Pick<
      SurfaceConnectors,
      | "saveThread"
      // The names this viewer writes under. Host-supplied because only the
      // host knows where its own account lives; there is no default route.
      | "identities"
      | "compose"
      | "composeSlots"
      | "timeZone"
      | "talkBaseUrl"
      | "readingVoice"
      | "threadToAnswers"
      | "dictionary"
      | "listMedia"
      | "onMutated"
      | "custom"
      // RSVP is host-shaped more often than not: the template apps take
      // POST/DELETE on /api/threads/:id/rsvp, IFAC takes {threadId,status} on
      // a single POST. Supply it to replace the default wholesale.
      | "rsvp"
    >
  >;

export interface HubConnectorOptions extends HostSupplied {
  /**
   * Turn a capability on. Omitted means the surface hides it rather than
   * showing an empty one — the same rule the hosts already followed by
   * leaving a connector out, just stated instead of implied.
   */
  board?: boolean;
  /**
   * The org's forum. `true` takes the default routes; the object form adds
   * what only the host can answer — `listFeed` is what lets the popup show a
   * SECTION's threads instead of navigating out to the board for them.
   */
  forum?: boolean | { listFeed?: (slug: string) => Promise<SurfaceForumThread[]> };
  /** The group's living documents in the org's Nextcloud folder. */
  documents?: boolean;
  /**
   * What a thread HOLDS — migration 131. Wired against `${routes.thread}/:id/
   * gather`, which is uniform across the template apps, so a host that serves
   * that route needs nothing here but `true`.
   *
   * Turning it OFF does not hide the band: a thread's gathered items arrive
   * with the thread itself, from `loadThread`. This is only the ability to
   * change what is there.
   */
  gather?: boolean;
  /**
   * Remove (archive) a thread from its popup — DELETE `${routes.thread}/:id`.
   * Who may is `viewer.canRemove`; the host's route enforces the same rule.
   */
  remove?: boolean;
  /**
   * Feature a meeting as the org's standing one from its popup — PATCH
   * `${routes.thread}/:id` with `{ standing }`. Editors only, on the route.
   */
  standing?: boolean;
  /**
   * Suggested ideas. Pass the ideas feed's path on the forum — the face
   * navigates there, so there is nothing sensible to default it to and an
   * org without an `ideas` feed should simply not turn this on.
   */
  ideas?: { href: string } | false;
  /** Whether this host serves the profile and center-layout routes. */
  profile?: boolean;
  /**
   * What a person's own page carries — the optional sections (writing, a
   * store) and whether they can be paid. Supplied by the host because both
   * answers are its own: the sections are rows it owns, and payouts mean
   * Stripe keys it holds. Omit and the profile surface is the card it was.
   */
  profilePage?: SurfaceProfilePageConnectors;
  /**
   * "Where you show" in the profile popup, served at `routes.presence`
   * (GET → SurfacePresence, POST {row,column,on}). Brief A slice 2.
   */
  presence?: boolean;
  /**
   * "Post to…" from /center, served at `routes.postTo` (GET → targets,
   * POST {target,title,text} → {href,label}). Brief A slice 3.
   */
  postTo?: boolean;
  centerLayout?: boolean;
  routes?: Partial<HubRoutes>;
}

/**
 * Build a host's SurfaceConnectors from the few things that are genuinely
 * its own. Everything returned here is overridable by the host spreading its
 * own key over the result, so this is a floor, never a ceiling.
 */
export function createHubConnectors(opts: HubConnectorOptions): SurfaceConnectors {
  const r: HubRoutes = { ...DEFAULT_ROUTES, ...opts.routes };
  const signedIn = opts.viewer.signedIn;

  const connectors: SurfaceConnectors = {
    viewer: opts.viewer,
    orgName: opts.orgName,
    timeZone: opts.timeZone,
    talkBaseUrl: opts.talkBaseUrl,
    readingVoice: opts.readingVoice,
    uploadEndpoint: r.upload,

    async loadThread(id) {
      const res = await fetch(`${r.thread}/${encodeURIComponent(id)}`);
      // 404 and 403 both mean "nothing to show": the route answers 404 for an
      // unpublished thread on purpose, so its existence is not confirmed.
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) throw new Error(`loadThread ${res.status}`);
      return (await res.json()) as SurfaceThread;
    },

    async listEvents(from, to) {
      const res = await fetch(`${r.calendar}?from=${from.toISOString()}&to=${to.toISOString()}`);
      if (!res.ok) throw new Error(`listEvents ${res.status}`);
      return (await res.json()).events ?? [];
    },

    listMedia:
      opts.listMedia ??
      (async () => {
        const res = await fetch(r.mediaLibrary);
        if (!res.ok) throw new Error(`listMedia ${res.status}`);
        const data = await res.json();
        return (data.items ?? []).map((i: { url: string; filename: string }) => ({
          url: i.url,
          name: i.filename,
        }));
      }),

    rsvp:
      opts.rsvp ??
      (async (thread, going) => {
        const res = await fetch(`${r.rsvp}/${thread.id}/rsvp`, {
          method: going ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: going ? JSON.stringify({ receiveEmailNotice: true }) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Could not update your RSVP." };
        return { ok: true, attending: Boolean(data.attending), count: data.count };
      }),

    saveThread: opts.saveThread,
    identities: opts.identities,
    compose: opts.compose,
    composeSlots: opts.composeSlots,
    threadToAnswers: opts.threadToAnswers,
    dictionary: opts.dictionary,
    custom: opts.custom,
    onMutated: opts.onMutated,
  };

  if (opts.centerLayout) {
    connectors.centerLayout = {
      async load(orgId) {
        const res = await fetch(`${r.centerLayout}?org=${encodeURIComponent(orgId)}`);
        if (res.status === 404 || res.status === 401) return null;
        if (!res.ok) throw new Error(`centerLayout ${res.status}`);
        return (await res.json()) as SurfaceCenterLayout;
      },
      async save(orgId, layout) {
        const res = await fetch(`${r.centerLayout}?org=${encodeURIComponent(orgId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(layout),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Could not save that." };
        return { ok: true };
      },
    };
  }

  if (opts.postTo) {
    connectors.postTo = {
      async targets() {
        const res = await fetch(r.postTo);
        if (!res.ok) throw new Error(`postTo ${res.status}`);
        const data = await res.json();
        return Array.isArray(data.targets) ? (data.targets as SurfacePostTarget[]) : [];
      },
      async create(input) {
        const res = await fetch(r.postTo, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false as const, error: data.error ?? "Could not post that." };
        return { ok: true as const, href: (data.href as string | null) ?? null, label: String(data.label ?? "") };
      },
    };
  }

  if (opts.profile) {
    connectors.profile = {
      async load(target) {
        const q = target ? `?org=${encodeURIComponent(target.orgId)}` : "";
        const res = await fetch(`${r.profile}${q}`);
        if (res.status === 404 || res.status === 401) return null;
        if (!res.ok) throw new Error(`profile ${res.status}`);
        return (await res.json()) as SurfaceProfile;
      },
      async save(target, input) {
        const q = target ? `?org=${encodeURIComponent(target.orgId)}` : "";
        const res = await fetch(`${r.profile}${q}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Could not save that." };
        return { ok: true };
      },
      ...(opts.profilePage ? { page: opts.profilePage } : {}),
      ...(opts.presence
        ? {
            presence: {
              async load() {
                const res = await fetch(r.presence);
                if (!res.ok) throw new Error(`presence ${res.status}`);
                return (await res.json()) as SurfacePresence;
              },
              async set(change) {
                const res = await fetch(r.presence, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(change),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { ok: false as const, error: data.error ?? "Could not save that." };
                return { ok: true as const, pending: Boolean(data.pending) };
              },
            },
          }
        : {}),
      async uploadAvatar(file) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(r.avatar, { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) return { ok: false, error: data.error ?? "Could not upload that." };
        return { ok: true, url: data.url as string };
      },
    };
  }

  if (opts.board) {
    // Nextcloud Deck's shapes are translated here; the surfaces read only
    // SurfaceBoard, so Deck's vocabulary stops at this boundary.
    connectors.board = {
      async load() {
        const res = await fetch(r.pipeline);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`board ${res.status}`);
        const b = await res.json();
        if (!b) return null;
        return {
          title: b.title ?? "Pipeline",
          canWrite: signedIn,
          pageHref: r.pipelinePage,
          stacks: (b.stacks ?? []).map(
            (s: { id: number; title: string; cards?: DeckCardJson[] }) => ({
              id: s.id,
              title: s.title,
              cards: (s.cards ?? [])
                .filter((c) => !c.archived)
                .map((c) => ({
                  id: c.id,
                  stackId: c.stackId,
                  title: c.title,
                  description: c.description ?? null,
                  dueAt: c.duedate ?? null,
                  done: Boolean(c.done),
                  labels: (c.labels ?? []).map((l) => ({ id: l.id, title: l.title, color: l.color })),
                  assignees: (c.assignedUsers ?? []).map(
                    (a) => a.participant?.displayname ?? a.participant?.uid ?? ""
                  ),
                  commentsCount: c.commentsCount ?? 0,
                  attachmentCount: c.attachmentCount ?? 0,
                })),
            })
          ),
        } as SurfaceBoard;
      },
      async createCard(stackId, title) {
        const res = await fetch(`${r.pipeline}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stackId, title }),
        });
        if (!res.ok) return null;
        const c = (await res.json()) as DeckCardJson;
        return {
          id: c.id,
          stackId: c.stackId,
          title: c.title,
          description: c.description ?? null,
          dueAt: c.duedate ?? null,
          done: Boolean(c.done),
        };
      },
      async updateCard(cardId, patch) {
        const res = await fetch(`${r.pipeline}/cards/${cardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: patch.title,
            description: patch.description,
            duedate: patch.dueAt ?? null,
          }),
        });
        return res.ok;
      },
      async setDone(cardId, done) {
        const res = await fetch(`${r.pipeline}/cards/${cardId}/state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done }),
        });
        return res.ok;
      },
      async moveCard(cardId, toStackId) {
        const res = await fetch(`${r.pipeline}/cards/${cardId}/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toStackId, order: 0 }),
        });
        return res.ok;
      },
      async listComments(cardId) {
        const res = await fetch(`${r.pipeline}/cards/${cardId}/comments`);
        if (!res.ok) return [];
        const rows = (await res.json()) as Array<{
          id: number;
          message: string;
          actorDisplayName?: string;
          author?: string;
          creationDateTime?: string;
          at?: string;
        }>;
        return rows.map((row) => ({
          id: row.id,
          message: row.message,
          author: row.actorDisplayName ?? row.author ?? "Someone",
          at: row.creationDateTime ?? row.at ?? new Date().toISOString(),
        }));
      },
      async addComment(cardId, message) {
        const res = await fetch(`${r.pipeline}/cards/${cardId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        return res.ok;
      },
    };
  }

  if (opts.documents) {
    connectors.documents = {
      async list() {
        const res = await fetch(r.documents);
        if (!res.ok) throw new Error(`documents ${res.status}`);
        return ((await res.json()).documents ?? []) as SurfaceDocument[];
      },
      async create(input) {
        // An empty body asks for a scrap doc; the route names it by date. The
        // naming decision is the step at which most notes never get taken, so
        // it has to be skippable from here, not just from the form.
        const res = await fetch(r.documents, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.document) {
          return { ok: false, error: data.error ?? "Could not create it." };
        }
        return { ok: true, document: data.document as SurfaceDocument };
      },
      async assign(documentId, ideaId) {
        const res = await fetch(r.documents, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, ideaId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Could not assign it." };
        return { ok: true };
      },
      async remove(documentId) {
        const res = await fetch(
          `${r.documents}?documentId=${encodeURIComponent(documentId)}`,
          { method: "DELETE" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Could not remove it." };
        return { ok: true };
      },
    };
  }

  if (opts.remove) {
    connectors.removeThread = async (threadId) => {
      const res = await fetch(`${r.thread}/${encodeURIComponent(threadId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error ?? "Could not remove it." };
      return { ok: true };
    };
  }

  if (opts.standing) {
    connectors.standing = {
      async set(threadId, on) {
        const res = await fetch(`${r.thread}/${encodeURIComponent(threadId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ standing: on }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? "Could not change it." };
        return { ok: true, standing: Boolean(data.standing) };
      },
    };
  }

  if (opts.gather) {
    // Every verb is its own request. Nothing is staged in the surface, so
    // closing the panel cannot lose an arrangement somebody thought was saved.
    const at = (threadId: string) =>
      `${r.thread}/${encodeURIComponent(threadId)}/gather`;

    connectors.gather = {
      async list(threadId) {
        const res = await fetch(at(threadId));
        if (!res.ok) return [];
        return ((await res.json()).gathered ?? []) as SurfaceGathered[];
      },
      async candidates(threadId, q) {
        const res = await fetch(`${at(threadId)}?q=${encodeURIComponent(q)}`);
        if (!res.ok) return [];
        return ((await res.json()).candidates ?? []) as SurfaceGatherCandidate[];
      },
      async attach(threadId, candidate) {
        const res = await fetch(at(threadId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(candidate),
        });
        return res.ok;
      },
      async detach(threadId, edgeId) {
        const res = await fetch(
          `${at(threadId)}?edgeId=${encodeURIComponent(edgeId)}`,
          { method: "DELETE" }
        );
        return res.ok;
      },
      async reorder(threadId, edgeIds) {
        const res = await fetch(at(threadId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edgeIds }),
        });
        return res.ok;
      },
    };
  }

  if (opts.ideas) {
    connectors.ideas = {
      href: opts.ideas.href,
      async list() {
        const res = await fetch(r.ideas);
        if (!res.ok) throw new Error(`ideas ${res.status}`);
        return ((await res.json()).ideas ?? []) as SurfaceIdea[];
      },
      async create(input) {
        const res = await fetch(r.ideas, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.idea) {
          return { ok: false, error: data.error ?? "Could not save that." };
        }
        return { ok: true, idea: data.idea as SurfaceIdea };
      },
    };
  }

  if (opts.forum) {
    const forumOpts = typeof opts.forum === "object" ? opts.forum : {};
    connectors.forum = {
      ...(forumOpts.listFeed ? { listFeed: forumOpts.listFeed } : {}),
      async load() {
        const res = await fetch(r.forumSnapshot);
        if (!res.ok) throw new Error(`forum ${res.status}`);
        return await res.json();
      },
      async markAllRead() {
        // The board's own form action, posted from here. It answers with a 303
        // back to the page a form came from; we only need whether it took.
        const res = await fetch(r.forumReadAll, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ back: "/hub" }),
          redirect: "manual",
        });
        return res.ok || res.type === "opaqueredirect" || res.status === 303;
      },
    };
  }

  return connectors;
}
