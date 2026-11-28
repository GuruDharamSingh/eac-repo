"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  SurfaceProvider,
  useSurfaceOptional,
  type SurfaceConnectors,
  type SurfaceDescriptor,
} from "@elkdonis/cms-ui/surface";
import { artworkFrame, auctionsFrame, entryFrame, installationsFrame, moneyFrame, salesFrame, storeFrame } from "./descriptors";
import { ArtistEditFrame, ArtistFrame, ArtworkFrame, AuctionsFrame, EntryFrame, InstallationFrame, InstallationsFrame, MoneyFrame, PieceFrame, SalesFrame, StoreFrame } from "./frames";

/**
 * The one surface provider for /center (cms-ui's popup system: one <dialog>, layers stacked inside it). The
 * market has no threads here, so `loadThread` answers nothing; the popups are this app's custom surfaces.
 */
export function CenterSurfaces({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      viewer: { signedIn, canCompose: false },
      loadThread: async () => null,
      timeZone: "America/Toronto",
      onMutated: () => router.refresh(),
      custom: {
        "market-store": ({ descriptor }) => <StoreFrame descriptor={descriptor} />,
        "market-artwork": ({ descriptor }) => <ArtworkFrame descriptor={descriptor} />,
        "market-piece": ({ descriptor }) => <PieceFrame descriptor={descriptor} />,
        "market-entry": ({ descriptor }) => <EntryFrame descriptor={descriptor} />,
        "market-money": () => <MoneyFrame />,
        "market-sales": () => <SalesFrame />,
        "market-auctions": () => <AuctionsFrame />,
        "market-installations": () => <InstallationsFrame />,
        "market-artist": ({ descriptor }) => <ArtistFrame descriptor={descriptor} />,
        "market-artist-edit": ({ descriptor }) => <ArtistEditFrame descriptor={descriptor} />,
        "market-installation": ({ descriptor }) => <InstallationFrame descriptor={descriptor} />,
      },
    }),
    [signedIn, router],
  );
  return (
    <SurfaceProvider connectors={connectors}>
      <OpenFromQuery />
      {children}
    </SurfaceProvider>
  );
}

/** `/center?open=<popup>` opens that popup on arrival (the store front's owner bar, the profile card), then drops the param. */
const OPENABLE: Record<string, () => SurfaceDescriptor> = {
  store: () => storeFrame("front"),
  profile: () => storeFrame("profile"),
  shipping: () => storeFrame("shipping"),
  artwork: () => artworkFrame(),
  entry: () => entryFrame(),
  sales: () => salesFrame(),
  auctions: () => auctionsFrame(),
  installations: () => installationsFrame(),
  look: () => storeFrame("look"),
  money: () => moneyFrame(),
};

function OpenFromQuery() {
  const surface = useSurfaceOptional();
  React.useEffect(() => {
    if (!surface || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const key = url.searchParams.get("open");
    const make = key ? OPENABLE[key] : undefined;
    if (!make) return;
    url.searchParams.delete("open");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    surface.open(make());
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** A button that opens one of the popups, growing it out of the button (the surface's morph). */
export function OpenFrame({
  frame,
  className,
  children,
  ...rest
}: { frame: SurfaceDescriptor; className?: string; children: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const surface = useSurfaceOptional();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={className}
      onClick={(e) => surface?.open(frame, e.currentTarget)}
      {...rest}
    >
      {children}
    </button>
  );
}
