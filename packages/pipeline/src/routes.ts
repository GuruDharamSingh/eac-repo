// ============================================================================
// The pipeline API, as a factory.
//
// Each app used to carry ~15 near-identical route files whose only real content
// was "call this org-deck function, wrap it in the app's auth". Duplicated
// across two apps that is 30 files, and adding an endpoint meant writing it
// twice. Here an app supplies its orgId and its two auth probes, and gets the
// handlers back.
//
// It deliberately does NOT re-wrap every org-deck function: a second copy of
// those signatures is exactly the kind of parallel surface that drifts, and
// @elkdonis/services already exposes them org-scoped. Routes take `orgId` from
// here and call the service directly.
//
// The permission split is the same one org-deck enforces server-side:
//   member      — read, and day-to-day card work (create, move, edit)
//   owner/guide — the board's shape: stacks, deleting cards, provisioning
// The client also hides controls a viewer can't use, but that is presentation.
// ============================================================================

import { NextResponse } from "next/server";
import { OrgDeckScopeError } from "@elkdonis/services";

/** The minimum an app's viewer must expose. Apps may return a richer object. */
export interface PipelineViewer {
  userId: string;
  email: string;
}

export interface PipelineRouteOptions<V extends PipelineViewer> {
  /** The org whose board these routes serve. No board id ever crosses the wire. */
  orgId: string;
  /** Signed-in member of this org, or null. */
  getMember: () => Promise<V | null>;
  /** Owner or guide of this org, or null. */
  getEditor: () => Promise<V | null>;
  /** Prefixes scope-refusal logs, e.g. "ifac". Defaults to the orgId. */
  logLabel?: string;
}

/** Parses a numeric route/body value, or null when it isn't one. */
export function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function createPipelineApi<V extends PipelineViewer>(
  options: PipelineRouteOptions<V>
) {
  const { orgId, getMember, getEditor } = options;
  const label = options.logLabel ?? orgId;

  async function run(
    handler: (viewer: V) => Promise<NextResponse>,
    viewer: V
  ): Promise<NextResponse> {
    try {
      return await handler(viewer);
    } catch (error) {
      // A card or stack that isn't on this org's board is not an upstream
      // failure — it's this site being asked about someone else's board.
      if (error instanceof OrgDeckScopeError) {
        console.warn(`[${label}] pipeline scope refusal:`, error.message);
        return NextResponse.json(
          { error: "No such card or list on this board" },
          { status: 404 }
        );
      }
      console.error(`[${label}] pipeline error:`, error);
      return NextResponse.json(
        { error: "Nextcloud rejected that change" },
        { status: 502 }
      );
    }
  }

  async function withMember(
    handler: (viewer: V) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const viewer = await getMember();
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return run(handler, viewer);
  }

  async function withEditor(
    handler: (viewer: V) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const viewer = await getEditor();
    if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return run(handler, viewer);
  }

  return {
    /** The org these routes serve. Routes pass it straight to @elkdonis/services. */
    orgId,
    withMember,
    withEditor,
    num,
    badRequest,
  };
}

export type PipelineApi<V extends PipelineViewer = PipelineViewer> = ReturnType<
  typeof createPipelineApi<V>
>;
