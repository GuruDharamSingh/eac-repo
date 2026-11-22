"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import type { Block } from "@elkdonis/blocks";
import { SOURCES } from "@/registry/sources";

// ============================================================================
// What the Sites screens share to DRAW a stored page: the registry's blocks loaded one source at a time (a source
// that fails is a line, not a crash), a boundary that turns a block that cannot draw into a labelled placeholder,
// the placeholder itself, and the example rows a block that draws from the database gets underneath its settings.
// ============================================================================

export class Boundary extends Component<{ children: ReactNode; was: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error !== null ? (
      <div className="st-missing">
        <strong>This block did not draw here</strong>
        <p>
          &ldquo;{this.props.was}&rdquo; needs something this app does not have (its own data, or its site). It is still in the page. ({this.state.error})
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function Missing({ was }: { was: string }) {
  return (
    <div className="st-missing">
      <strong>A block this app cannot load</strong>
      <p>
        &ldquo;{was}&rdquo; is not one of the blocks this app has. It is shown as a placeholder here and stays in the page, untouched.
      </p>
    </div>
  );
}

/** Load every registered block source, each on its own. */
export function useRegistry(): { loaded: Map<string, Block<never>>; loadErrors: string[]; done: boolean } {
  const [loaded, setLoaded] = useState<Map<string, Block<never>>>(new Map());
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const s of SOURCES) {
        try {
          const blocks = await s.load();
          if (!alive) return;
          setLoaded((prev) => {
            const next = new Map(prev);
            for (const b of blocks) if (!next.has(b.def.id)) next.set(b.def.id, b);
            return next;
          });
        } catch (e) {
          if (alive) setLoadErrors((p) => [...p, `${s.label}: ${e instanceof Error ? e.message : String(e)}`]);
        }
      }
      if (alive) setDone(true);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return { loaded, loadErrors, done };
}

/** The example rows a data-driven block draws with (what its settings do not declare), or null. */
export function sampleRowsOf(b: Block<never> | undefined): Record<string, unknown> | null {
  if (!b || !b.def.dataDriven || !b.sample) return null;
  try {
    const row = (b.sample as () => unknown)() as Record<string, unknown>;
    const declared = new Set(b.def.props.map((p) => p.name));
    return Object.fromEntries(Object.entries(row ?? {}).filter(([k]) => !declared.has(k)));
  } catch {
    return null;
  }
}
