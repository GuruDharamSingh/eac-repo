"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * After a /studio or /admin control saves, it refreshes the page (router.refresh). Inside a /center or /hub popup
 * the popup's own data was loaded once and would stay stale, so a popup provides this context and the control
 * calls it too. Outside a popup the context is empty and only the page refreshes, as before. (2026-11-26)
 */
export const PopupRefresh = React.createContext<(() => void) | null>(null);

export function useAfterSave(): () => void {
  const router = useRouter();
  const notify = React.useContext(PopupRefresh);
  return React.useCallback(() => {
    router.refresh();
    notify?.();
  }, [router, notify]);
}
