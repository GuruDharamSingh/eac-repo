"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { savePageAction } from "@/lib/puck/actions";

type Resolved = Record<string, Record<string, unknown>>;

/** Rows a feed block fetches are drawn but never saved, so they are kept apart from the document. */
function resolvedProps(doc: PuckDoc): Resolved {
  const out: Resolved = {};
  const go = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const n of list as Array<{ props?: Record<string, unknown> }>) {
      if (!n?.props || typeof n.props.id !== "string") continue;
      out[n.props.id] = n.props;
      for (const v of Object.values(n.props)) if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "props" in x)) go(v);
    }
  };
  go(doc.content);
  return out;
}

/** The editor and its stylesheet load only here, on opening. */
export function CanvasEditor({ slug, orgId, initial }: { slug: string; orgId: string; initial: PuckDoc }) {
  const host = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const [{ mountTreePage }, { canvasConfig }, { choosePicture }, puck] = await Promise.all([
        import("@elkdonis/direct-edit/puck"),
        import("@/lib/puck/config.client"),
        import("@/components/landing/page-picture-chooser"),
        import("@puckeditor/core"),
        import("@elkdonis/direct-edit/direct-edit.css" as string),
      ]);
      const metadata = { orgId, slug };
      const config = canvasConfig as unknown as Parameters<typeof mountTreePage>[0]["config"];
      const filled = await puck.resolveAllData(initial as never, canvasConfig, metadata).catch(() => initial);
      if (cancelled || !host.current) return;
      const editor = mountTreePage({
        host: host.current,
        config,
        doc: initial,
        resolved: resolvedProps(filled as PuckDoc),
        metadata,
        choosePicture,
        blockEditorHref: `/studio/${slug}`,
        onSave: (d) => savePageAction(slug, d),
        onDone: () => router.push("/studio"),
      });
      stop = () => editor.dispose();
    })().catch((err) => {
      console.error("[canvas] open:", err);
      setFailed(true);
    });
    return () => { cancelled = true; stop?.(); };
    // Mount once per page load; the editor owns its state from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return <p style={{ padding: "2rem" }}>The editor could not open. Reload the page to try again.</p>;
  return <div ref={host} style={{ minHeight: "100vh", paddingTop: 44 }} />;
}
