"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { PrimaryButton, SectionHeader } from "@/components/mobile";
import { saveSettingsAction } from "@/app/manage/settings/actions";
import type { SiteSettings } from "@/lib/site-settings";
import { cx } from "./cx";
import "./board.css";

// /manage/settings on a phone (and centred on desktop). Two settings, in the pack's rule wording
// (data-and-state.md, "Slot state"). Owners edit; guides read the same screen without the controls.

const RULES: Array<{ key: SiteSettings["belowMinimumRule"]; label: string; line: string }> = [
  { key: "guide_decides", label: "Guide decides", line: "When booking closes below the minimum, the guide runs it, reopens booking, or cancels and refunds." },
  { key: "auto_cancel", label: "Auto-cancel", line: "When booking closes below the minimum, the slot is cancelled and guests are refunded automatically." },
];

export function SettingsView({ initial, canEdit }: { initial: SiteSettings; canEdit: boolean }) {
  const [rule, setRule] = React.useState(initial.belowMinimumRule);
  const [hold, setHold] = React.useState(initial.holdGuidePosts);
  const [saved, setSaved] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const dirty = rule !== saved.belowMinimumRule || hold !== saved.holdGuidePosts;

  function save() {
    setError(null);
    start(async () => {
      const r = await saveSettingsAction({ belowMinimumRule: rule, holdGuidePosts: hold });
      if (r.ok === false) { setError(r.error); return; }
      setSaved(r.settings);
      toast("Settings saved.");
    });
  }

  return (
    <div className="b-page b-settings">
      <div className="b-head">
        <Link href="/manage" className="b-sr-link b-settings-back">‹ Manage</Link>
        <h1 className="b-title">Settings</h1>
      </div>
      <p className="b-intro">{canEdit ? "How the house runs. Changes apply at once." : "How the house runs. Only an owner can change these."}</p>

      <SectionHeader label="Below the minimum" />
      <div className="b-opts" role="radiogroup" aria-label="When a slot closes below its minimum">
        {RULES.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={rule === o.key}
            disabled={!canEdit}
            className={cx("b-opt", rule === o.key && "is-on")}
            onClick={() => setRule(o.key)}
          >
            <span className="b-opt-label">{o.label}</span>
            <span className="b-opt-line">{o.line}</span>
          </button>
        ))}
      </div>

      <SectionHeader label="Guides' posts" />
      <div className="b-opts" role="radiogroup" aria-label="Guides' posts on Discover">
        <button type="button" role="radio" aria-checked={hold} disabled={!canEdit} className={cx("b-opt", hold && "is-on")} onClick={() => setHold(true)}>
          <span className="b-opt-label">The office confirms first</span>
          <span className="b-opt-line">A guide&apos;s post waits for you before it goes on Discover and in the forum Feed.</span>
        </button>
        <button type="button" role="radio" aria-checked={!hold} disabled={!canEdit} className={cx("b-opt", !hold && "is-on")} onClick={() => setHold(false)}>
          <span className="b-opt-label">Guides publish straight away</span>
          <span className="b-opt-line">A guide&apos;s post goes up at once. The office&apos;s own posts always do.</span>
        </button>
      </div>

      {error ? <p className="b-err b-settings-msg" role="alert">{error}</p> : null}
      {canEdit ? (
        <div className="b-form-actions">
          <PrimaryButton onClick={save} disabled={!dirty || pending}>{pending ? "Saving…" : "Save settings"}</PrimaryButton>
        </div>
      ) : null}
    </div>
  );
}
