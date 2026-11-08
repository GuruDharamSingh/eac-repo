import type { Outlet } from "@/lib/channel/model";

const NAMES: Record<Outlet, string> = {
  site: "Website",
  page: "Your page",
  market: "Market",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  youtube: "YouTube",
  video: "Video",
  writing: "Writing",
  live: "Live",
  newsletter: "Letter",
};

export function outletLabel(o: Outlet): string {
  return NAMES[o] ?? o;
}
