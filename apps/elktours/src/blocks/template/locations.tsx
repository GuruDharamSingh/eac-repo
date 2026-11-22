import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { LocationsView } from "./views.client";
import { samplePage } from "./sample";

// ============================================================================
// locations (TEMPLATE lane, 2026-11-21): the places of the record in the address, as a map and/or an ordered list. With the
// defaults it is the phone tour page's route section exactly (map, then the stops that open for their address and place
// card). Order, how much each place says, and a picture per place are settings. The picture is the place's own existing
// cover for now (a plain on/off); which picture is chosen is lane MEDIA's.
// ============================================================================

const props = [
  { name: "showMap", kind: "boolean", label: "Show the map", default: true },
  { name: "showList", kind: "boolean", label: "Show the list", default: true },
  {
    name: "order",
    kind: "select",
    label: "Order",
    default: "route",
    options: [
      { value: "route", label: "As visited" },
      { value: "alphabetical", label: "A to Z" },
    ],
  },
  {
    name: "detail",
    kind: "select",
    label: "How much each place says",
    default: "full",
    options: [
      { value: "name", label: "Name only" },
      { value: "summary", label: "Name, kind and time" },
      { value: "full", label: "Everything, opening for the address" },
    ],
  },
  { name: "showCover", kind: "boolean", label: "Show a picture for each place", default: false },
] as const;

export const locations = defineBlock(
  {
    id: "locations",
    category: "content",
    label: "Map and locations",
    description: "The places of the record on this page, on a map and as an ordered list.",
    memberSafe: true,
    dataDriven: true,
    interactive: true,
    styling: "tokens",
    props,
    reads: [
      { from: "route", what: "record", kinds: ["tour"] },
      { from: "site", what: "org" },
    ],
    parts: { root: { label: "Map and locations", sel: "> .tb-root" } },
  },
  ({ page, showMap, showList, order, detail, showCover }: PropsOf<typeof props> & { page?: unknown }) => (
    <LocationsView
      page={page as never}
      showMap={showMap}
      showList={showList}
      order={order === "alphabetical" ? "alphabetical" : "route"}
      detail={detail === "name" || detail === "summary" ? detail : "full"}
      showCover={showCover}
    />
  ),
  () => ({ showMap: true, showList: true, order: "route", detail: "full", showCover: false, page: samplePage() }) as never
);
