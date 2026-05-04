"use client";

import { useState } from "react";
import { CreateContentDialog } from "@/components/cms/create-content-dialog";

type Props = {
  orgSlug: string;
  workshopsUrl: string;
  silexEditorUrl?: string;
  isOwner: boolean;
};

/**
 * Floating editorial bar shown to owners/admins on the subdomain public page.
 * Provides quick access to content creation and editing without leaving the
 * subdomain context.
 */
export function SubdomainEditorBar({
  orgSlug,
  workshopsUrl,
  silexEditorUrl,
  isOwner,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "rgba(15,23,42,0.92)",
        backdropFilter: "blur(10px)",
        borderRadius: 32,
        padding: "8px 14px",
        border: "0.5px solid rgba(255,255,255,0.14)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 12,
        color: "rgba(255,255,255,0.85)",
        letterSpacing: "0.02em",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          paddingRight: 6,
          borderRight: "0.5px solid rgba(255,255,255,0.2)",
          marginRight: 4,
          color: "rgba(255,255,255,0.45)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {isOwner ? "Owner" : "Admin"}
      </span>

      {/* Quick post/meeting (existing dialog) */}
      <div style={{ display: "contents" }}>
        <CreateContentDialog
          orgSlug={orgSlug}
          triggerLabel="+ New"
          triggerVariant="ghost"
          triggerSize="sm"
        />
      </div>

      <BarButton href={workshopsUrl} external={false}>
        Workshops
      </BarButton>

      {silexEditorUrl && isOwner && (
        <BarButton href={silexEditorUrl} external>
          Edit layout
        </BarButton>
      )}
    </div>
  );
}

function BarButton({
  href,
  external,
  children,
}: {
  href: string;
  external: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      style={{
        color: "rgba(255,255,255,0.85)",
        textDecoration: "none",
        padding: "4px 10px",
        borderRadius: 20,
        transition: "background 0.15s",
        fontSize: 12,
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLAnchorElement).style.background = "rgba(255,255,255,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLAnchorElement).style.background = "transparent";
      }}
    >
      {children}
    </a>
  );
}
