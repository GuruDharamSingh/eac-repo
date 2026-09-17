"use client";

import * as React from "react";
import {
  EmailSurface,
  type EmailSuiteData,
  type EmailTab,
} from "@elkdonis/cms-ui/email";
import { SurfaceFrame, SurfaceSkeleton, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { useEmailConnectors } from "./use-email-connectors";

/**
 * The email suite in the shared popup, fetching its own data on open.
 *
 * Self-fetching rather than prop-fed because the surface provider is mounted
 * in the ROOT layout: handing it the suite would mean seven queries on every
 * page of the site so that a popup most visitors never open could be instant.
 *
 * It also survives a reload. `?surface=` puts the descriptor in the URL, and a
 * descriptor can only carry JSON — so a surface whose data arrived as props
 * would come back empty after a refresh, while this one simply fetches again.
 */
export function EmailPopup({
  descriptor,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "custom" }>;
}) {
  const connectors = useEmailConnectors();
  const [state, setState] = React.useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: EmailSuiteData; canEdit: boolean }
  >({ status: "loading" });

  const load = React.useCallback(() => {
    let live = true;
    fetch("/api/hub/email", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (live) setState({ status: "ready", data: body.data, canEdit: body.canEdit });
      })
      .catch(() => {
        if (live) setState({ status: "error", message: "Couldn't load this organisation's email." });
      });
    return () => {
      live = false;
    };
  }, []);

  React.useEffect(load, [load]);

  // The suite's own connectors call `refresh` after every write; here that has
  // to re-fetch rather than re-render a server component, since this panel got
  // its data from a route.
  const withRefresh = React.useMemo(
    () => ({ ...connectors, refresh: () => void load() }),
    [connectors, load]
  );

  if (state.status === "loading") {
    return (
      <SurfaceFrame kind="neutral" title="Email">
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }
  if (state.status === "error") {
    return (
      <SurfaceFrame kind="neutral" title="Email">
        <p className="eac-surface-empty">{state.message}</p>
      </SurfaceFrame>
    );
  }

  return (
    <EmailSurface
      data={state.data}
      connectors={withRefresh}
      canEdit={state.canEdit}
      tab={(descriptor.props?.tab as EmailTab | undefined) ?? "activity"}
    />
  );
}
