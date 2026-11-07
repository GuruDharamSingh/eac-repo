"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { ToastProvider, type ToastSink } from "@elkdonis/cms-ui/manage/client";
import { Toaster } from "@/components/ui/sonner";

// The kit's toasts go to sonner, which this app's manage pages already call
// (elktours' wrapper, docs/reference/manage-ui.md). Before 2026-11-07 no
// <Toaster> was mounted anywhere in this app, so those sonner calls showed
// nothing; it is mounted here now, for every /manage page.
const toSonner: ToastSink = (t) => (t.ok ? toast.success(t.message) : toast.error(t.message));

export function ManageToasts({ children }: { children: ReactNode }) {
  return (
    <ToastProvider sink={toSonner}>
      {children}
      <Toaster position="bottom-right" theme="dark" />
    </ToastProvider>
  );
}
