"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "./store";

/** The sound store as React state: prefs, site defaults, the playing track's key. */
export function useSoundState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
