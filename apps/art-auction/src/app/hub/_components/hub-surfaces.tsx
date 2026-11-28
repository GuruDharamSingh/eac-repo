"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceProvider, useSurfaceOptional, type SurfaceConnectors, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { ApplicationsFrame, MembersFrame, MoneyHubFrame, OrderConfirmFrame, OrderFrame, OrdersFrame, SeriesFrame, StoresFrame } from "./hub-frames";

/**
 * /hub's surface provider: the stacked popups (orders → order → refund, stores). The Content and Channel cards
 * keep their own one-layer popup (HubCardMount); the two sit on one page (content contract §10.5).
 */
export function HubSurfaces({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const connectors = React.useMemo<SurfaceConnectors>(
    () => ({
      viewer: { signedIn: true, canCompose: false },
      loadThread: async () => null,
      timeZone: "America/Toronto",
      onMutated: () => router.refresh(),
      custom: {
        "hub-orders": ({ descriptor }) => <OrdersFrame descriptor={descriptor} />,
        "hub-order": ({ descriptor }) => <OrderFrame descriptor={descriptor} />,
        "hub-order-confirm": ({ descriptor }) => <OrderConfirmFrame descriptor={descriptor} />,
        "hub-stores": ({ descriptor }) => <StoresFrame descriptor={descriptor} />,
        "hub-applications": () => <ApplicationsFrame />,
        "hub-series": () => <SeriesFrame />,
        "hub-money": () => <MoneyHubFrame />,
        "hub-members": () => <MembersFrame />,
      },
    }),
    [router],
  );
  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}

/** A card face that opens a popup, growing out of the card. */
export function HubOpen({ frame, className, label, children }: { frame: SurfaceDescriptor; className?: string; label: string; children: React.ReactNode }) {
  const surface = useSurfaceOptional();
  return (
    <button type="button" aria-haspopup="dialog" aria-label={label} className={className} onClick={(e) => surface?.open(frame, e.currentTarget)}>
      {children}
    </button>
  );
}
