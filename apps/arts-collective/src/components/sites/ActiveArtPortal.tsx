"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ACTIVE_ART_SLOT } from "@/lib/cms/community-render";
import { ActiveArtMatch } from "@/components/active-art-match";

export function ActiveArtPortal() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(ACTIVE_ART_SLOT));
  }, []);

  if (!slot) return null;

  return createPortal(<ActiveArtMatch />, slot);
}
