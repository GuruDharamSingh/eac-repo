"use client";

import * as React from "react";
import Link from "next/link";
import { SurfaceFrame, useSurfaceOptional, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { PhoneThemeToggle } from "@/components/mobile/phone-theme";

// Client-safe imports only (no services, no DB modules): everything the popup shows arrives in descriptor.props.

export interface CityMenuProps {
  cityName: string;
  sheetTitle: string;
  moreTitle: string;
  moreText: string;
  suggestLabel: string;
  loginLabel: string;
  accountLabel: string;
  /** null = signed out. */
  viewer: { name: string | null; office: boolean } | null;
}

/** The descriptor the Discover masthead opens: a PUBLIC `city-menu` surface (City sheet contents plus account). */
export function cityMenuDescriptor(p: CityMenuProps): SurfaceDescriptor {
  return { type: "custom", key: "city-menu", title: p.sheetTitle, kind: "neutral", size: "compact", props: { ...p } };
}

/** City choice, More cities, Suggest, and the account area (Log in / first name, The Office for editors). */
export function CityMenuPopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const p = (descriptor.props ?? {}) as Partial<CityMenuProps>;
  const surface = useSurfaceOptional();
  const done = () => surface?.close();
  const viewer = p.viewer ?? null;
  return (
    <SurfaceFrame kind="neutral" kicker="The guide" title={p.sheetTitle || "Choose a city"}>
      <div className="blk-mmast-sheet">
        <div className="blk-mmast-citycard">{p.cityName || "Paris"}</div>
        <span className="m-kicker">{p.moreTitle}</span>
        <p>{p.moreText}</p>
        {p.suggestLabel ? <Link href="/suggest" className="blk-mmast-suggest" onClick={done}>{p.suggestLabel}</Link> : null}
        <span className="m-kicker">Account</span>
        <Link href={viewer ? "/account" : "/login"} className="blk-mmast-account" onClick={done}>
          {viewer ? viewer.name || p.accountLabel || "Account" : p.loginLabel || "Log in"}
        </Link>
        {viewer?.office ? <Link href="/manage" className="blk-mmast-account" onClick={done}>The Office →</Link> : null}
        <PhoneThemeToggle />
      </div>
    </SurfaceFrame>
  );
}
