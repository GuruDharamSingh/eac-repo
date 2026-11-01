"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSurfaceOptional, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import type { LmsTaskBoxProps } from "@elkdonis/lms-ui";
import { gainSpaceAction } from "@/lib/cms/journey-actions";

/**
 * The box under a task step: where the person stands, and the one control
 * that does the thing — here, in this host's own surface (the profile popup,
 * a journey dialog, the artwork queue), or a link to the page that does it.
 * When the dialog closes the page refreshes and the step re-reads its state.
 */

const ARTDIRECT = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
const NEXTCLOUD = (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "");
const SOPHIA = (process.env.NEXT_PUBLIC_SOPHIA_URL ?? "").replace(/\/$/, "");

type Control =
  | { kind: "surface"; label: string; descriptor: SurfaceDescriptor; hint?: string }
  | { kind: "link"; label: string; href: string; external?: boolean; hint?: string }
  | { kind: "gain-space"; label: string }
  | { kind: "none"; hint: string };

function control(p: LmsTaskBoxProps): Control {
  const { task, status, orgId } = p;
  switch (task.id) {
    case "profile":
      return { kind: "surface", label: status.partial ? "Finish your profile" : "Fill in your profile", descriptor: { type: "profile", mode: "edit" } };
    case "gain-space":
      return { kind: "gain-space", label: "Take my space" };
    case "listing":
      return status.partial
        ? { kind: "surface", label: "Open “Where you show”", descriptor: { type: "profile", tab: "show" }, hint: "Switch on the network directory." }
        : { kind: "surface", label: "Choose your page address", descriptor: { type: "profile", tab: "details" }, hint: "Your address is under Details." };
    case "studio":
      return { kind: "link", label: status.partial ? "Back to the Studio" : "Open the Studio", href: "/studio", hint: "Write, then press Publish." };
    case "show-on":
      return { kind: "surface", label: "Choose where it shows", descriptor: { type: "profile", tab: "show" }, hint: "“Show on” lists each piece on the sites you belong to." };
    case "cloud":
      return NEXTCLOUD
        ? { kind: "link", label: "Open the cloud", href: `${NEXTCLOUD}/login`, external: true, hint: "Press “Sign in with Elkdonis” there, once. Your folders appear within about ten minutes." }
        : { kind: "none", hint: "The cloud sign-in is not configured on this site." };
    case "service":
      return { kind: "surface", label: status.partial ? "Publish your service" : "Offer a service", descriptor: { type: "journey", id: "profile" }, hint: "Under “Offer & get paid”." };
    case "store":
      return { kind: "surface", label: status.partial ? "See your store" : "Open a store", descriptor: { type: "journey", id: "auction" }, hint: "Step 2 of “Sell your art”." };
    case "artwork":
      return { kind: "surface", label: status.partial ? "Finish and publish" : "Add a work", descriptor: { type: "artwork" } };
    case "payouts":
      return { kind: "surface", label: status.partial ? "Finish with Stripe" : "Set up payouts", descriptor: { type: "journey", id: "auction" }, hint: "Step 3 of “Sell your art”. Stripe brings you back here." };
    case "org":
      return { kind: "surface", label: "Start an organisation", descriptor: { type: "journey", id: "site" } };
    case "org-details":
      return orgId ? { kind: "surface", label: "Fill in the details", descriptor: { type: "journey", id: "org", orgId } } : { kind: "none", hint: "Start an organisation first." };
    case "org-people":
      return orgId ? { kind: "surface", label: "Who is in it", descriptor: { type: "journey", id: "org", orgId }, hint: "The People tab." } : { kind: "none", hint: "Start an organisation first." };
    case "org-offering":
      return status.href ? { kind: "link", label: "Open your console", href: status.href, hint: "Publish a post, an event or a service and pin the one that should lead, or design the page under Settings → Site & address." } : { kind: "none", hint: "Start an organisation first." };
    case "org-email":
      return status.href ? { kind: "link", label: "Open the email suite", href: status.href, hint: "The Look tab: a sending name and a reply-to address." } : { kind: "none", hint: "Start an organisation first." };
    case "org-site":
      return status.href && status.done ? { kind: "link", label: "Open your site", href: status.href, external: true } : { kind: "none", hint: "Nothing to press: the collective confirms the address and adds it to the edge." };
    default:
      return { kind: "none", hint: "This step is not known to this site yet." };
  }
}

export function TaskBox(p: LmsTaskBoxProps) {
  const surfaces = useSurfaceOptional();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { status } = p;
  const c = control(p);

  // When a dialog opened from here closes, the page re-reads the task.
  const openSurface = (d: SurfaceDescriptor) => {
    if (!surfaces) return;
    surfaces.open(d);
  };
  React.useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const state = status.done ? "Done" : status.partial ? "Begun" : "Not yet";
  const stateClass = status.done ? "so-task__state so-task__state--done" : status.partial ? "so-task__state so-task__state--partial" : "so-task__state";

  if (!p.signedIn) {
    return (
      <>
        <p className={stateClass}><span>{state}</span></p>
        <p className="so-task__detail">This is something you do on your own account.</p>
        <div className="so-task__act"><a className="so-btn" href={p.signInHref}>Sign in to do this</a></div>
      </>
    );
  }

  return (
    <>
      <p className={stateClass}><span>{state}</span>{status.done && status.href && <a href={status.href} target={status.href.startsWith("http") ? "_blank" : undefined} rel="noopener">See it →</a>}</p>
      {status.detail && <p className="so-task__detail">{status.detail}</p>}
      {!p.enrolled && <p className="so-meta">Begin the course below to have this recorded.</p>}
      <div className="so-task__act">
        {c.kind === "surface" && (
          surfaces ? (
            <button type="button" className={status.done ? "so-btn so-btn--quiet" : "so-btn"} onClick={() => openSurface(c.descriptor)}>{status.done ? "Open again" : c.label}</button>
          ) : (
            <a className="so-btn" href={`/hub/network?surface=${encodeURIComponent(serialize(c.descriptor))}`}>{c.label}</a>
          )
        )}
        {c.kind === "link" && (
          <a className={status.done ? "so-btn so-btn--quiet" : "so-btn"} href={c.href} {...(c.external ? { target: "_blank", rel: "noopener" } : {})}>{c.label}{c.external ? " ↗" : ""}</a>
        )}
        {c.kind === "gain-space" && !status.done && (
          <button
            type="button"
            className="so-btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const r = await gainSpaceAction().catch(() => ({ ok: false as const, error: "Could not reach the server." }));
              setBusy(false);
              if ("error" in r) setError(r.error);
              else router.refresh();
            }}
          >
            {busy ? "Setting up…" : c.label}
          </button>
        )}
        {"hint" in c && c.hint && <span className="so-meta">{c.hint}</span>}
        {task_hint(p.task.id) && <span className="so-meta">{task_hint(p.task.id)}</span>}
      </div>
      {error && <p className="so-meta" role="alert">{error}</p>}
    </>
  );
}

function task_hint(id: string): string | null {
  if (id === "listing" && ARTDIRECT) return `Your page lives at ${ARTDIRECT.replace(/^https?:\/\//, "")}/<your address>.`;
  if (id === "studio" && SOPHIA) return null;
  return null;
}

/** The profile and journey descriptors as the URL scheme spells them (surface/url.ts). */
function serialize(d: SurfaceDescriptor): string {
  if (d.type === "profile") return d.tab ? `profile:${d.tab}` : "profile";
  if (d.type === "journey") return d.orgId ? `journey:${d.id}:${d.orgId}` : `journey:${d.id}`;
  if (d.type === "artwork") return "artwork";
  return "profile";
}
