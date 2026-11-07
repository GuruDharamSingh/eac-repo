// Harness (2026-11-07): elktours' tour popup opened on its Stops tab, registered as HubSurfaces registers it, so the
// phone layout (the map sticks under the tab strip while the stops scroll) can be measured. The driver answers
// /api/surfaces/tour/<id> with a copy of the live public JSON.
import "@elkdonis/blocks/blocks.css";
import { createElement as h, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { SurfaceProvider, useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import { TourPopup, tourDescriptor } from "/app/apps/elktours/src/components/tours/tour-popup";

function Opener() {
  const s = useSurfaceOptional();
  useEffect(() => { s?.open(tourDescriptor({ id: "elkNapol001tour000003", slug: "heritage", title: "L'héritage de Napoléon Bonaparte" })); }, [s?.open]);
  return null;
}
const connectors = { custom: { tour: ({ descriptor }: any) => h(TourPopup, { descriptor }) } };
createRoot(document.getElementById("host")!).render(h(SurfaceProvider as any, { connectors }, h(Opener), h("main", { style: { padding: 16 } }, "Page under the popup")));
