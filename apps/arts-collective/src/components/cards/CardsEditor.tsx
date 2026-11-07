"use client";

import "@elkdonis/direct-edit/direct-edit.css";
import "@/components/classifieds/classifieds.css";
import { useEffect, useRef } from "react";
import type { Item } from "@elkdonis/direct-edit/block";
import { mountClassifiedsEditor } from "@/lib/classifieds/editor-engine";
import { CARD_LABELS, CARD_TEMPLATES, FEED_FIELDS, FEED_FIELD_KINDS, cardsToSheet, sheetToCards, type CardsDoc } from "@/lib/cards/catalog";
import { saveCardsAction } from "@/lib/cards/actions";

/**
 * Mounts the block editor in pattern mode: one card design drawn for every
 * item of the org's live feed (or sample items when it has none). Editing any
 * card edits the design; every card follows.
 */
export function CardsEditor({ orgSlug, orgName, doc, items, live, viewUrl }: { orgSlug: string; orgName: string; doc: CardsDoc; items: Item[]; live: boolean; viewUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return mountClassifiedsEditor(ref.current, {
      doc: cardsToSheet(doc),
      orgName,
      threads: [],
      viewUrl,
      onSave: (d) => saveCardsAction(orgSlug, sheetToCards(d)),
      pattern: {
        items, fields: FEED_FIELDS, fieldKinds: FEED_FIELD_KINDS, labels: CARD_LABELS, title: "Feed cards", templates: CARD_TEMPLATES,
        source: live ? `Live: the ${items.length} newest public posts of ${orgName}` : `${orgName} has no public posts yet, so these are sample items`,
      },
    });
    // Mount once per page load; the engine owns its state from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} />;
}
