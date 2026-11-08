"use client";

import * as React from "react";
import Link from "next/link";
import { ContentDetail, type ContentDetailConnectors } from "@elkdonis/content/ui";
import type { Suggestion } from "@/lib/channel/model";
import { channelPieceToDetail } from "@/lib/channel/content-detail";
import { acceptSuggestionAction, dismissSuggestionAction, savePlanAction, setPlanStepAction, startPlanAction } from "@/lib/channel/actions";
import { CHANNEL_BASE, suggestionInput, useChannel } from "./context";
import { specFromSuggestion } from "./quick-spec";

/**
 * The piece pop-up (3a): opened from the face on Home, it grows from the card.
 * Overview = where it went and under which name; Plan = plan.md (3c) beside
 * the board's waiting suggestions. The view itself lives in @elkdonis/content
 * (ContentDetail); this feeds it the piece through channelPieceToDetail and
 * wires its writes to Channel's server actions.
 */
export function PieceSurface({ pieceKey, initialTab }: { pieceKey: string; initialTab: "overview" | "plan" }) {
  const { piece: find, href, model, scopeOrg, openLibrary, openQuick, openAdjust } = useChannel();
  const piece = find(pieceKey);
  const detail = React.useMemo(() => (piece ? channelPieceToDetail(piece, model, { href, base: CHANNEL_BASE }) : null), [piece, model, href]);

  const connectors = React.useMemo<ContentDetailConnectors | null>(() => {
    if (!piece) return null;
    // Content suggestions carry the Channel suggestion's id; find it again for the actions and sheets.
    const byId = new Map<string, Suggestion>();
    for (const s of piece.suggestions) byId.set(s.id, s);
    for (const row of Object.values(piece.coverage)) for (const cell of Object.values(row)) if (cell.suggestion && !byId.has(cell.suggestion.id)) byId.set(cell.suggestion.id, cell.suggestion);
    const original = (id: string) => byId.get(id)!;
    return {
      act: (async (entry: string, input: Record<string, unknown>) => {
        switch (entry) {
          case "plan.start":
            return startPlanAction(piece.key, piece.ownerIdentityId, scopeOrg);
          case "plan.save":
            return savePlanAction(piece.key, piece.ownerIdentityId, scopeOrg, input.bodyMd as string, input.expectedUpdatedAt as string | null);
          case "plan.step":
            return setPlanStepAction(piece.key, piece.ownerIdentityId, scopeOrg, input.index as number, input.done as boolean, input.text as string | null);
          case "suggestion.accept":
            return acceptSuggestionAction(suggestionInput(original((input.suggestion as { id: string }).id), scopeOrg));
          case "suggestion.dismiss":
            return dismissSuggestionAction(suggestionInput(original((input.suggestion as { id: string }).id), scopeOrg));
          default:
            return { ok: false, error: `Unknown action ${entry}` };
        }
      }) as ContentDetailConnectors["act"],
      openSuggestion: (s, origin) => {
        const sg = original(s.id);
        const routine = sg.routineId ? model.routines.find((r) => r.id === sg.routineId) : undefined;
        openQuick(specFromSuggestion(sg, piece, routine?.name ?? null), origin);
      },
      adjustSuggestion: (s, origin) => openAdjust(original(s.id), origin),
      switchItem: (key) => openLibrary(key),
      Link,
    };
  }, [piece, model.routines, scopeOrg, openLibrary, openQuick, openAdjust]);

  return <ContentDetail model={detail} connectors={connectors ?? NO_CONNECTORS} initialTab={initialTab} tabInAddress notFound="This piece is not in your channel." />;
}

const NO_CONNECTORS: ContentDetailConnectors = { act: async () => ({ ok: false, error: "This piece is not in your channel." }) };
