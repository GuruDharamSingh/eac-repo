import type { SurfaceDescriptor } from "@elkdonis/cms-ui/surface";

/** The /hub popups (custom keys registered in hub-surfaces.tsx). A plain module, so the server page can use them. */
export const ordersFrame = (filter: "pay" | "ship" | "done" | "all" = "ship"): SurfaceDescriptor => ({
  type: "custom", key: "hub-orders", title: "Orders", kind: "board", size: "wide", props: { filter },
});
export const orderFrame = (id: string, number?: string): SurfaceDescriptor => ({
  type: "custom", key: "hub-order", title: number ? `Order ${number}` : "Order", kind: "board", size: "wide", props: { id },
});
export const orderConfirmFrame = (input: { id: string; number: string; total: string; act: "cancel" | "refund" }): SurfaceDescriptor => ({
  type: "custom", key: "hub-order-confirm", title: input.act === "refund" ? "Refund" : "Cancel the order", kind: "board", size: "compact", props: input,
});
export const storesFrame = (filter: "active" | "pending" | "paused" | "all" = "active"): SurfaceDescriptor => ({
  type: "custom", key: "hub-stores", title: "Stores", kind: "product", size: "wide", props: { filter },
});
export const applicationsFrame = (): SurfaceDescriptor => ({
  type: "custom", key: "hub-applications", title: "Applications", kind: "product", size: "wide",
});
export const seriesFrame = (): SurfaceDescriptor => ({
  type: "custom", key: "hub-series", title: "Series", kind: "series", size: "wide",
});
export const moneyHubFrame = (): SurfaceDescriptor => ({
  type: "custom", key: "hub-money", title: "Money", kind: "service", size: "wide",
});
export const membersFrame = (): SurfaceDescriptor => ({
  type: "custom", key: "hub-members", title: "Members", kind: "neutral", size: "wide",
});
