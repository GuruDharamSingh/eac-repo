"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Mail,
  Menu,
  Palette,
  PanelsTopLeft,
  PenLine,
  Radio,
  Repeat,
  Settings,
  IdCard,
  Store,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { fmtWeekdayTime, type PieceKind } from "@/lib/channel/model";
import { CHANNEL_BASE, useChannel } from "./context";
import { IdentityMark, OUTLET_ICON } from "./icons";

export type NavActive = "home" | "matrix" | "new" | "queue" | "piece" | "outlets" | "routines";

interface Row {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string | null;
  onClick?: () => void;
  meta?: React.ReactNode;
  metaTone?: "live" | "accent" | "dot" | "muted" | "alert";
  active?: boolean;
  external?: boolean;
}

/**
 * The long left column (ChannelNav, design 244 px). Inside Channel it
 * replaces the Studio's nav. Groups fold; Audience and Site settings start
 * folded for an artist. Items whose destination does not exist for this
 * scope are left out rather than drawn and refused.
 */
export function ChannelNav({ active, outletTab }: { active: NavActive; outletTab?: string | null }) {
  const { model, href, openLibrary } = useChannel();
  const [phoneOpen, setPhoneOpen] = React.useState(false);
  const isOrg = model.scope.kind === "org";
  const name = model.scope.kind === "org" ? model.scope.name : model.viewer.name;
  const initials = model.scope.kind === "org" ? model.identities[0]?.initials ?? "·" : model.viewer.initials;
  const sub = isOrg ? "Channel" : `Artist channel${model.orgs.length ? ` · ${model.orgs.length} ${model.orgs.length === 1 ? "org" : "orgs"}` : ""}`;

  const library = (kind: PieceKind | null) => () => openLibrary(kind ? `kind:${kind}` : null);
  const ig = model.outlets.find((o) => o.id === "instagram");

  const groups: Array<{ id: string; title: string | null; open: boolean; rows: Row[] }> = [
    {
      id: "main",
      title: null,
      open: true,
      rows: [
        { id: "home", label: "Home", icon: LayoutGrid, href: href(CHANNEL_BASE), active: active === "home" || active === "matrix" },
        { id: "new", label: "New post", icon: PenLine, href: href(`${CHANNEL_BASE}/new`), active: active === "new" },
        { id: "queue", label: "Queue", icon: CalendarDays, href: href(`${CHANNEL_BASE}/queue`), meta: model.counts.queue || null, active: active === "queue" },
        { id: "routines", label: "Routines", icon: Repeat, href: href(`${CHANNEL_BASE}/routines`), meta: model.routines.length || null, active: active === "routines" },
        { id: "live", label: "Live", icon: Radio, href: href(`${CHANNEL_BASE}/outlets`, { tab: "live" }), meta: model.nextLive ? fmtWeekdayTime(model.nextLive.at, model.timeZone) : null, metaTone: "live", active: active === "outlets" && outletTab === "live" },
      ],
    },
    ...(isOrg
      ? []
      : [
          {
            id: "as",
            title: "Publishing as",
            open: true,
            rows: model.identities.map<Row>((i) => ({
              id: i.id,
              label: i.kind === "user" ? i.name : i.name,
              icon: i.kind === "user" ? UsersRound : Users,
              href: i.kind === "org" && i.orgId ? `${CHANNEL_BASE}?org=${encodeURIComponent(i.orgId)}` : CHANNEL_BASE,
              active: false,
              meta: i.kind === "user" ? "You" : "Org",
              metaTone: "muted" as const,
            })),
          },
        ]),
    {
      id: "content",
      title: "Content",
      open: true,
      rows: [
        { id: "writing", label: "Writing", icon: FileText, onClick: library("writing"), meta: model.counts.writing },
        { id: "video", label: "Video", icon: Film, onClick: library("video"), meta: model.counts.video },
        { id: "artwork", label: "Artwork", icon: ImageIcon, onClick: library("artwork"), meta: model.counts.artwork },
        { id: "series", label: "Series", icon: Layers, onClick: library("series"), meta: model.counts.series },
        { id: "meeting", label: "Meeting", icon: UsersRound, onClick: library("meeting"), meta: model.counts.meeting },
      ],
    },
    {
      id: "outlets",
      title: "Outlets",
      open: true,
      rows: model.outlets
        .filter((o) => o.id !== "threads" || o.connected)
        .map<Row>((o) => ({
          id: o.id,
          label: o.label,
          icon: OUTLET_ICON[o.id],
          href: href(`${CHANNEL_BASE}/outlets`, { tab: o.id }),
          active: active === "outlets" && outletTab === o.id,
          meta: !o.connected ? "Connect" : o.id === "instagram" && o.left !== null ? `${o.left} of ${o.total}` : "●",
          metaTone: !o.connected ? "accent" : o.id === "instagram" && o.left === 0 ? "alert" : o.id === "instagram" ? "muted" : "dot",
        })),
    },
    {
      id: "audience",
      title: "Audience",
      open: isOrg,
      rows: [
        { id: "newsletter", label: "Newsletter", icon: Mail, href: href(`${CHANNEL_BASE}/outlets`, { tab: "newsletter" }), meta: "Email", metaTone: "muted", active: active === "outlets" && outletTab === "newsletter" },
        { id: "people", label: "People", icon: Users, href: model.links.people, meta: model.counts.people ?? null },
      ],
    },
    {
      id: "site",
      title: "Site settings",
      open: false,
      rows: [
        { id: "pages", label: "Pages", icon: PanelsTopLeft, href: model.links.pages, meta: "Puck", metaTone: "muted" },
        { id: "template", label: "Template", icon: Palette, href: model.links.template },
        { id: "store", label: "Pieces and shop", icon: Store, href: model.links.store },
        { id: "identity", label: "Identity and SEO", icon: IdCard, href: model.links.identity },
      ],
    },
  ];

  return (
    <nav className="chn-nav" aria-label="Channel" data-open={phoneOpen ? "1" : "0"}>
      <div className="chn-nav-head">
        <IdentityMark initials={initials} kind={isOrg ? "org" : "user"} size={32} />
        <div className="chn-nav-who">
          <strong>{name}</strong>
          <span>{sub}</span>
        </div>
        <ScopeSwitcher />
        <button type="button" className="chn-nav-phone" aria-expanded={phoneOpen} onClick={() => setPhoneOpen((v) => !v)}>
          <Menu size={18} aria-hidden /> <span>Menu</span>
        </button>
      </div>
      <div className="chn-nav-body">
        <div className="chn-nav-links">
          <a href={model.links.hub}>← Hub</a>
          <a href={model.links.studio}>Studio</a>
          {model.links.site && (
            <a href={model.links.site} target="_blank" rel="noreferrer">
              Site ↗
            </a>
          )}
        </div>
        {groups.map((g) => (
          <NavGroup key={g.id} title={g.title} defaultOpen={g.open || g.rows.some((r) => r.active)} rows={g.rows.filter((r) => r.href || r.onClick)} />
        ))}
        <div className="chn-nav-foot">
          <NavRow row={{ id: "settings", label: "Channel settings", icon: Settings, href: href(`${CHANNEL_BASE}/routines`) }} />
        </div>
      </div>
    </nav>
  );
}

function NavGroup({ title, defaultOpen, rows }: { title: string | null; defaultOpen: boolean; rows: Row[] }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  if (rows.length === 0) return null;
  return (
    <div className="chn-nav-group">
      {title && (
        <button type="button" className="chn-nav-gh" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          <span>{title}</span>
          <ChevronDown size={12} aria-hidden data-open={open ? "1" : "0"} />
        </button>
      )}
      <ul id={id} hidden={!open}>
        {rows.map((r) => (
          <li key={r.id}>
            <NavRow row={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavRow({ row }: { row: Row }) {
  const Icon = row.icon;
  const inner = (
    <>
      <Icon size={17} strokeWidth={1.6} aria-hidden className="chn-nav-icon" />
      <span className="chn-nav-label">{row.label}</span>
      {row.meta !== null && row.meta !== undefined && row.meta !== "" && (
        <span className="chn-nav-meta" data-tone={row.metaTone ?? "muted"}>
          {row.metaTone === "dot" ? (
            <>
              <span className="chn-dot" aria-hidden />
              <span className="chn-sr">Connected</span>
            </>
          ) : (
            row.meta
          )}
        </span>
      )}
      {row.external && <ExternalLink size={11} aria-hidden className="chn-nav-out" />}
    </>
  );
  if (row.onClick)
    return (
      <button type="button" className="chn-nav-row" onClick={row.onClick}>
        {inner}
      </button>
    );
  const href = row.href!;
  const internal = href.startsWith(CHANNEL_BASE);
  return internal ? (
    <Link href={href} className="chn-nav-row" aria-current={row.active ? "page" : undefined}>
      {inner}
    </Link>
  ) : (
    <a href={href} className="chn-nav-row" target={row.external ? "_blank" : undefined} rel={row.external ? "noreferrer" : undefined}>
      {inner}
    </a>
  );
}

function ScopeSwitcher() {
  const { model } = useChannel();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (model.orgs.length === 0) return null;
  const current = model.scope.kind === "org" ? model.scope.orgId : null;
  return (
    <div className="chn-switch" ref={ref}>
      <button type="button" className="chn-iconbtn" aria-expanded={open} aria-label="Switch channel" onClick={() => setOpen((v) => !v)}>
        <ChevronsUpDown size={15} aria-hidden />
      </button>
      {open && (
        <ul className="chn-switch-menu">
          <li>
            <a href={CHANNEL_BASE} aria-current={current === null ? "true" : undefined}>
              <IdentityMark initials={model.viewer.initials} kind="user" size={20} /> {model.viewer.name}
              <small>Your channel</small>
            </a>
          </li>
          {model.orgs.map((o) => (
            <li key={o.orgId}>
              <a href={`${CHANNEL_BASE}?org=${encodeURIComponent(o.orgId)}`} aria-current={current === o.orgId ? "true" : undefined}>
                <IdentityMark initials={o.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()} kind="org" size={20} /> {o.name}
                <small>{o.role === "owner" ? "Owner" : "Guide"}</small>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
