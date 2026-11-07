"use client";

import "@elkdonis/direct-edit/direct-edit.css";
import "./classifieds.css";
import { useEffect, useRef } from "react";
import type { ClassifiedsDoc } from "@/lib/classifieds/catalog";
import { mountClassifiedsEditor, type EditorThread } from "@/lib/classifieds/editor-engine";
import { saveClassifiedsAction } from "@/lib/classifieds/actions";

/** Mounts the plain-DOM classifieds editor (lib/classifieds/editor-engine.ts over @elkdonis/direct-edit). */
export function ClassifiedsEditor({ orgSlug, orgName, doc, threads, viewUrl }: { orgSlug: string; orgName: string; doc: ClassifiedsDoc; threads: EditorThread[]; viewUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return mountClassifiedsEditor(ref.current, {
      doc,
      orgName,
      threads,
      viewUrl,
      onSave: (d) => saveClassifiedsAction(orgSlug, d),
    });
    // Mount once per page load; the engine owns its state from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} />;
}
