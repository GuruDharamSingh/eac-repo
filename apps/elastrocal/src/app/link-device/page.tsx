import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { LINK_APPS, cleanLabel, cleanState } from "./apps";
import { LinkButton } from "./link-button";

export const metadata: Metadata = { title: "Link a device" };

interface Props {
  searchParams: Promise<{ app?: string; label?: string; state?: string }>;
}

/**
 * Link one of the network's own apps (Jerusalem first) to the signed-in
 * account. The app opens this page in the phone's browser; after "Link", the
 * page hands a device token back through the app's URL scheme. See
 * packages/auth-server/src/device-tokens.ts and migration 194.
 */
export default async function LinkDevicePage({ searchParams }: Props) {
  const q = await searchParams;
  const app = q.app && LINK_APPS[q.app] ? q.app : null;
  const label = cleanLabel(q.label);
  const state = cleanState(q.state);

  const viewer = await getViewer();
  if (!viewer) {
    const back = `/link-device?${new URLSearchParams({ app: app ?? "", label, state }).toString()}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  if (!app) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-2xl font-semibold">Link a device</h1>
        <p className="mt-3 text-sm opacity-80">This page is opened from an app. Unknown app.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-2xl font-semibold">Link {LINK_APPS[app].name}</h1>
      <p className="mt-3 text-sm opacity-80">
        {LINK_APPS[app].name} on <strong>{label || "this device"}</strong> will act as <strong>{viewer.email}</strong>
        {viewer.role ? ` (${viewer.role} of Elastrocal)` : ""}: your charts, references and studio reviews.
      </p>
      <p className="mt-2 text-xs opacity-60">You can unlink it any time from the app or here.</p>
      <LinkButton app={app} label={label} state={state} />
    </div>
  );
}
