"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SurfaceFrame,
  SurfaceProvider,
  defaultThreadToAnswers,
  useSurface,
  type SurfaceConnectors,
} from "@elkdonis/cms-ui/surface";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import type { Offering } from "@elkdonis/services";
import {
  listMyOfferingsAction,
  loadMyOfferingAction,
  saveOfferingAction,
  setFeaturedOfferingAction,
  setOfferingStatusAction,
} from "@/lib/offering-actions";
import "@elkdonis/cms-ui/surface.css";
import "@elkdonis/cms-ui/fields.css";
import "@elkdonis/cms-ui/compose.css";
import "@elkdonis/cms-ui/editor.css";
import "@elkdonis/cms-ui/files-card.css";
import styles from "./ManageSpace.module.css";
import { openNewPieceAction } from "@/lib/writing-actions";

// ============================================================================
// "Manage your space" — the owner's panel on their own ArtDirect page.
//
// One button on the page; it opens a popup (the shared surface system, not a
// new dialog) listing the person's offerings, with: new meeting / service
// (the shared compose form), edit, publish / take down, feature one, write
// (the existing blog), and start a group (org setup on the network host).
// Rules: docs/open/ARTIST_FUNNEL_BRIEF_2026-09-27.md.
// ============================================================================

const TIME_ZONE = "America/Toronto";
const CHANGED = "oad:offerings-changed";

type Props = {
  slug: string;
  displayName: string | null;
  /** Where a new group is started (the network host's org setup). */
  startGroupHref: string;
  /** The person's writing page. */
  writingHref: string;
  /** Their bookings on the network hub: times to confirm for booked services. */
  bookingsHref: string;
};

export function ManageSpace({ slug, displayName, startGroupHref, writingHref, bookingsHref }: Props) {
  const router = useRouter();

  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      viewer: {
        signedIn: true,
        displayName,
        canCompose: true,
        // Only the owner's own offerings ever reach the popup here, and the
        // server re-checks authorship on every write.
        canEdit: () => true,
      },
      orgName: "ArtDirect",
      timeZone: TIME_ZONE,
      loadThread: (id) => loadMyOfferingAction(id),
      saveThread: async ({ kind, answers, status, threadId }) => {
        const result = await saveOfferingAction({ kind, answers, status, threadId });
        return result.ok === false ? { ok: false, error: result.error } : { ok: true, id: result.id, href: null };
      },
      threadToAnswers: (t) => ({
        ...defaultThreadToAnswers(t, { timeZone: TIME_ZONE }),
        time_zone: (t.extra?.time_zone as string | undefined) || TIME_ZONE,
        share_to_network: t.extra?.share_to_network === undefined ? true : Boolean(t.extra.share_to_network),
      }),
      compose: {
        orgSlug: "oad",
        canPublishContent: true,
        canPublishDated: true,
        hasMeetings: true,
        // Services carry booking fields and are booked by card on
        // /<slug>/services/<service> (the shared service layer).
        hasServices: true,
        canShareToNetwork: true,
        canCreateTalkRoom: false,
        canCreateDocument: false,
      },
      composeSlots: {
        body: ({ value, onChange, tier }) => (
          <RichTextEditor value={value} onChange={onChange} toolbar={tier === "quick" ? "compact" : "full"} />
        ),
        // Pictures go into the person's own folder (ArtDirect's upload route,
        // target=page: stored and returned, not added to the gallery).
        media: ({ value, onChange, label, hint, accept }) => (
          <MediaPicker
            value={typeof value === "string" ? value : undefined}
            onChange={onChange}
            uploadEndpoint={`/api/upload?target=page&slug=${encodeURIComponent(slug)}`}
            label={label ?? "Image"}
            hint={hint}
            accept={accept}
          />
        ),
      },
      custom: {
        "manage-space": () => (
          <ManagePanel startGroupHref={startGroupHref} writingHref={writingHref} bookingsHref={bookingsHref} />
        ),
      },
      onMutated: () => {
        window.dispatchEvent(new Event(CHANGED));
        router.refresh();
      },
    }),
    [slug, displayName, startGroupHref, writingHref, bookingsHref, router]
  );

  return (
    <SurfaceProvider connectors={connectors} syncUrl={false}>
      <div className={styles.dock}>
        <OpenButton />
      </div>
    </SurfaceProvider>
  );
}

function OpenButton() {
  const { open } = useSurface();
  return (
    <button
      type="button"
      className={styles.open}
      onClick={(e) =>
        open({ type: "custom", key: "manage-space", title: "Your space", size: "wide" }, e.currentTarget)
      }
    >
      Manage your space
    </button>
  );
}

const KIND_LABEL: Record<string, string> = { meeting: "Meeting", service: "Service" };

function ManagePanel({
  startGroupHref,
  writingHref,
  bookingsHref,
}: {
  startGroupHref: string;
  writingHref: string;
  bookingsHref: string;
}) {
  const { push, close } = useSurface();
  const router = useRouter();
  const [items, setItems] = React.useState<Offering[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setItems(await listMyOfferingsAction());
  }, []);

  React.useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(CHANGED, onChange);
    return () => window.removeEventListener(CHANGED, onChange);
  }, [load]);

  const act = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(id);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (!result.ok) setError(result.error ?? "Could not do that.");
    await load();
    router.refresh();
  };

  const compose = (kind: "meeting" | "service", threadId?: string) =>
    push({
      type: "compose",
      kind,
      tier: "full",
      ...(threadId ? { threadId } : { prefill: { share_to_network: true, currency: "CAD" } }),
    });

  return (
    <SurfaceFrame kind="custom" title="Your space" kicker="ArtDirect">
      <div className={styles.panel}>
        <section>
          <h3 className={styles.heading}>Offer something</h3>
          <p className={styles.note}>
            One offering can be featured with a page of its own; the others show as cards on your
            profile. Offerings are shared to the network unless you switch that off when you publish.
          </p>
          <div className={styles.row}>
            <button type="button" className={styles.primary} onClick={() => compose("meeting")}>
              New meeting
            </button>
            <button type="button" className={styles.primary} onClick={() => compose("service")}>
              New service
            </button>
            {/* Opens the writing desk on a new piece directly. */}
            <form action={openNewPieceAction}>
              <button type="submit" className={styles.secondary}>
                Write
              </button>
            </form>
            <a className={styles.secondary} href={writingHref}>
              Your writing
            </a>
            <a className={styles.secondary} href={bookingsHref}>
              Bookings
            </a>
          </div>
        </section>

        <section>
          <h3 className={styles.heading}>Your offerings</h3>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {items === null ? (
            <p className={styles.note}>Loading…</p>
          ) : items.length === 0 ? (
            <p className={styles.note}>Nothing yet.</p>
          ) : (
            <ul className={styles.list}>
              {items.map((o) => (
                <li key={o.id} className={styles.item}>
                  <div className={styles.itemText}>
                    <span className={styles.itemTitle}>{o.title}</span>
                    <span className={styles.itemMeta}>
                      {KIND_LABEL[o.kind] ?? o.kind}
                      {" · "}
                      {o.status === "published" ? "Published" : "Draft"}
                      {o.featured ? " · Featured" : ""}
                      {o.status === "published" && !o.shareToNetwork ? " · Not shared to the network" : ""}
                    </span>
                  </div>
                  <div className={styles.row}>
                    <button type="button" className={styles.secondary} onClick={() => compose(o.kind, o.id)}>
                      Edit
                    </button>
                    {o.status === "published" ? (
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={busy === o.id}
                        onClick={() => act(o.id, () => setOfferingStatusAction(o.id, "draft"))}
                      >
                        Take down
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={busy === o.id}
                        onClick={() => act(o.id, () => setOfferingStatusAction(o.id, "published"))}
                      >
                        Publish
                      </button>
                    )}
                    {o.status === "published" &&
                      (o.featured ? (
                        <button
                          type="button"
                          className={styles.secondary}
                          disabled={busy === o.id}
                          onClick={() => act(o.id, () => setFeaturedOfferingAction(null))}
                        >
                          Unfeature
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.secondary}
                          disabled={busy === o.id}
                          onClick={() => act(o.id, () => setFeaturedOfferingAction(o.id))}
                        >
                          Make featured
                        </button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className={styles.heading}>Start a group</h3>
          <p className={styles.note}>
            An organisation gives you a home of your own on the network, with a feed and a hub, so
            people can gather around your work. Your offerings here stay on your profile.
          </p>
          <div className={styles.row}>
            <a className={styles.secondary} href={startGroupHref} onClick={() => close()}>
              Start a group
            </a>
          </div>
        </section>
      </div>
    </SurfaceFrame>
  );
}
