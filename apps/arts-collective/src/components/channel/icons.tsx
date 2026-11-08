import {
  AtSign,
  CalendarDays,
  Facebook,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Instagram,
  Layers,
  Mail,
  Radio,
  Store,
  CircleUserRound,
  UsersRound,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { ItemState, Outlet, PieceKind } from "@/lib/channel/model";

// Icons are lucide (already an arts-collective dependency) in place of the
// mock's Phosphor duotone set; names map one to one (design README "Assets").

export const OUTLET_ICON: Record<Outlet, LucideIcon> = {
  site: Globe,
  page: CircleUserRound,
  market: Store,
  instagram: Instagram,
  facebook: Facebook,
  threads: AtSign,
  youtube: Youtube,
  video: Film,
  writing: FileText,
  live: Radio,
  newsletter: Mail,
};

export const KIND_ICON: Record<PieceKind, LucideIcon> = {
  artwork: ImageIcon,
  product: ImageIcon,
  writing: FileText,
  video: Film,
  series: Layers,
  meeting: UsersRound,
  event: CalendarDays,
  workshop: Layers,
};

export function OutletIcon({ outlet, state, size = 14, title }: { outlet: Outlet; state?: ItemState | "suggestion"; size?: number; title?: string }) {
  const Icon = OUTLET_ICON[outlet] ?? Globe;
  return (
    <span className="chn-oi" data-state={state ?? "published"} title={title} aria-hidden={title ? undefined : true}>
      <Icon size={size} strokeWidth={1.6} />
    </span>
  );
}

/** Artist = circle, org = 2px-radius square (design 3a). */
export function IdentityMark({ initials, kind, size = 18, title }: { initials: string; kind: "user" | "org"; size?: number; title?: string }) {
  return (
    <span className="chn-idm" data-kind={kind} style={{ width: size, height: size, fontSize: Math.max(7, Math.round(size * 0.42)) }} title={title} aria-label={title}>
      {initials}
    </span>
  );
}
