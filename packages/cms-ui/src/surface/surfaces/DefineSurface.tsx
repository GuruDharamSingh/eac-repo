"use client";

import * as React from "react";
import { useSurface, useLayer } from "../context";
import { SurfaceFrame } from "../SurfaceShell";
import type { SurfaceDescriptor } from "../types";

type Descriptor = Extract<SurfaceDescriptor, { type: "define" }>;

/**
 * Define a term into the network dictionary, mid-sentence.
 *
 * Pushed as a layer over whatever is being written, so the masthead carries a
 * "‹ back" to the article and accepting drops you back at your sentence. The
 * page is created on accept rather than queued until publish — the wiki is
 * network-wide, so a stub earns its keep even if this article is abandoned.
 *
 * It reports, before you commit, whether the term already has a page. That
 * matters because defining never overwrites: an existing page gets linked,
 * not replaced, since with open editing it may be a full article somebody
 * else wrote.
 */
export function DefineSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors, pop } = useSurface();
  const layer = useLayer();
  const dictionary = connectors.dictionary;

  const term = descriptor.term.trim();
  const [definition, setDefinition] = React.useState("");
  const [existing, setExisting] = React.useState<{
    slug: string;
    title: string;
    senses: number;
  } | null>(null);
  const [looking, setLooking] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{
    slug: string;
    created: boolean;
    senses: number;
    duplicate: boolean;
  } | null>(null);

  React.useEffect(() => {
    layer.setMeta({ title: term || "Define", kind: "define", size: "compact" });
  }, [term]);

  React.useEffect(() => {
    if (!dictionary || !term) {
      setLooking(false);
      return;
    }
    let live = true;
    dictionary
      .lookup(term)
      .then((hit) => live && setExisting(hit))
      .catch(() => live && setExisting(null))
      .finally(() => live && setLooking(false));
    return () => {
      live = false;
    };
  }, [dictionary, term]);

  async function accept() {
    if (!dictionary) return;
    setSaving(true);
    setError(null);
    try {
      const result = await dictionary.define({
        term,
        definition: definition.trim(),
        sourceThreadId: descriptor.sourceThreadId,
      });
      setDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  }

  if (!dictionary) {
    return (
      <SurfaceFrame kind="define" title={term}>
        <p className="eac-surface-empty">This app has no dictionary wired up.</p>
      </SurfaceFrame>
    );
  }

  if (done) {
    return (
      <SurfaceFrame
        kind="define"
        title={term}
        kicker={
          done.created
            ? "Added to the dictionary"
            : done.duplicate
              ? "Already said that way"
              : `Now ${done.senses} senses`
        }
        actions={[{ label: "Back to writing", primary: true, onClick: pop }]}
      >
        <p className="eac-define-said">
          {done.created
            ? `“${term}” now has a page. Anyone on the network can expand it.`
            : done.duplicate
              ? `That wording was already recorded for “${term}”, so nothing was added.`
              : `Your sense of “${term}” sits alongside the ${done.senses - 1} already there — none replaces another.`}
        </p>
      </SurfaceFrame>
    );
  }

  return (
    <SurfaceFrame
      kind="define"
      title={term}
      kicker={
        looking
          ? "Checking the dictionary…"
          : existing
            ? existing.senses > 0
              ? `${existing.senses} ${existing.senses === 1 ? "sense" : "senses"} already given`
              : "Already in the dictionary"
            : "New term"
      }
      status={error}
      statusTone={error ? "error" : "normal"}
      actions={[
        {
          label: existing ? "Add this sense" : "Define it",
          primary: true,
          disabled: saving || looking || !definition.trim(),
          onClick: accept,
        },
        { label: "Cancel", quiet: true, onClick: pop },
      ]}
    >
      {existing && (
        <p className="eac-define-said">
          <strong>{existing.title}</strong> is already in the dictionary. What
          you write here is added as another sense — it does not replace what
          anyone else has said.
        </p>
      )}
      <label className="eac-field">
        <span className="eac-field-label">
          {existing ? "What does it mean as you are using it?" : "What does it mean here?"}
        </span>
        <textarea
          className="eac-input eac-input--textarea"
          rows={4}
          autoFocus
          value={definition}
          placeholder={`One or two sentences. This is what a reader sees when they meet “${term}”.`}
          onChange={(e) => setDefinition(e.target.value)}
        />
        <span className="eac-field-hint">
          Kept in the network dictionary with your name on it. A word can hold
          more than one reading, and the next person can add theirs.
        </span>
      </label>
    </SurfaceFrame>
  );
}
