"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elkdonis/primitives";
import { CssPanel } from "@elkdonis/live-editor";
import type { CssVarDef } from "@elkdonis/live-editor";
import { toast } from "sonner";
import type { ThemeVars } from "@elkdonis/services";
import { HUB_SKINS, type HubSkin } from "@/lib/hub-skin";

/*
 * The whole-site scope is keyed "" (theme-tokens.ts), and a Select item may
 * not carry an empty value: the empty string is how a Select says "nothing is
 * chosen, show the placeholder", so Radix throws rather than let the two
 * meanings collide. The scope keeps its real key in state and in the save
 * call; only the control sees the stand-in.
 */
const SITE_SCOPE = "__site__";
const toItemValue = (key: string) => key || SITE_SCOPE;
const fromItemValue = (value: string) => (value === SITE_SCOPE ? "" : value);

/**
 * Appearance controls for the hub.
 *
 * The scope select and the "my profile" toggle sit above one CssPanel rather
 * than being three panels: they all edit the same kind of thing, and the panel
 * is remounted on scope change so it loads that scope's own values instead of
 * carrying the previous scope's edits across.
 */
export function AppearanceCard({
  vars,
  pages,
  overridesByPage,
  onSaveSite,
  skin,
  onSaveSkin,
}: {
  vars: CssVarDef[];
  pages: Array<{ key: string; label: string }>;
  overridesByPage: Record<string, ThemeVars>;
  onSaveSite: (pageKey: string, vars: ThemeVars) => Promise<{ ok: boolean; error?: string }>;
  /** The look the hub is wearing, and how to change it. */
  skin: HubSkin;
  onSaveSkin: (skin: HubSkin) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  // Optimistic, because the skin is read in the LAYOUT: the server action
  // revalidates it and the whole members' area re-renders, which is a beat
  // too slow for a select to feel connected to anything.
  const [pendingSkin, setPendingSkin] = useState<HubSkin | null>(null);
  const [saving, startSaving] = useTransition();
  const shownSkin = pendingSkin ?? skin;
  // "" and "hub" are site scopes; "@me" is this person's own profile pages.
  const [scope, setScope] = useState<string>(pages[0]?.key ?? "");

  const overrides = overridesByPage[scope] ?? {};

  return (
    <div className="hub-appearance">
      <div className="hub-panel-head">
        <h2>Appearance</h2>
        <span className="hub-tag">Colours</span>
      </div>

      <p className="hub-appearance-note">
        Two things live here. The <strong>look</strong> is the hub&rsquo;s whole
        construction — how a card is built, what the type is, where the rules
        run. The <strong>colours</strong> below it are the variables the rest
        of the site reads, so a change there restyles pages and live components
        together.
      </p>

      <div className="hub-appearance-controls">
        <div className="eac-field">
          <Label htmlFor="appearance-skin">The look</Label>
          <Select
            value={shownSkin}
            disabled={saving}
            onValueChange={(next) => {
              const chosen = next as HubSkin;
              setPendingSkin(chosen);
              startSaving(async () => {
                const result = await onSaveSkin(chosen);
                if (result.ok) {
                  toast.success("The hub is wearing the new look.");
                } else {
                  setPendingSkin(null);
                  toast.error(result.error ?? "Could not save that");
                }
              });
            }}
          >
            <SelectTrigger id="appearance-skin" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HUB_SKINS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="hub-appearance-hint">
          {HUB_SKINS.find((option) => option.key === shownSkin)?.note}
        </p>
      </div>

      <div className="hub-appearance-controls">
        {/* The shared controls rather than a bare <select> and a bare
            <button>. Those inherited the browser's own chrome, which on this
            page meant a blue-grey macOS dropdown sitting on IFAC's paper —
            and, in every other browser, something different again. */}
        <div className="eac-field">
          <Label htmlFor="appearance-scope">Editing</Label>
          <Select
            value={toItemValue(scope)}
            onValueChange={(next) => setScope(fromItemValue(next))}
          >
            <SelectTrigger id="appearance-scope" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.key} value={toItemValue(p.key)}>
                  {p.label}
                </SelectItem>
              ))}
              {/* "My profile pages" deliberately absent: colours you can't see
                  while choosing them are guesswork. That editor lives on the
                  profile page itself, under "Page colours". */}
            </SelectContent>
          </Select>
        </div>

        {!open && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Open editor
          </Button>
        )}
      </div>

      {open && (
        <CssPanel
          key={scope}
          cssVars={vars}
          initialOverrides={overrides}
          onSave={(next) => onSaveSite(scope, next)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
