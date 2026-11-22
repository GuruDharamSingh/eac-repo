"use client";

import { Suspense, lazy, useMemo, type ComponentType } from "react";
import type { MockEntry } from "@/registry/mocks";

const cache = new Map<string, ComponentType>();

/** One lazy component per mock (cached by app:id so a remount does not reload it). */
function componentFor(key: string, entry: MockEntry): ComponentType {
  let c = cache.get(key);
  if (!c) {
    c = lazy(entry.load);
    cache.set(key, c);
  }
  return c;
}

/**
 * Draws a mock inside its own scope wrapper. The wrapper carries data-mock-app so the mock's CSS
 * (scoped under that attribute) cannot leak onto other tiles; the app's theme variables are set by
 * the mock's own stylesheet, not by the theme switcher.
 */
export function MockPreview({ itemKey, app, entry }: { itemKey: string; app: string; entry: MockEntry }) {
  const Mock = useMemo(() => componentFor(itemKey, entry), [itemKey, entry]);
  return (
    <div data-mock-app={entry.scope ?? app} data-mock-kind={entry.kind} className="dev-mock-scope">
      <Suspense fallback={<div style={{ padding: 24, color: "#888", font: "13px system-ui" }}>Loading mock...</div>}>
        <Mock />
      </Suspense>
    </div>
  );
}
