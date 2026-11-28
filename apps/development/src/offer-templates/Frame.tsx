"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { OfferSurfaceRoot, type SurfaceLook } from "@elkdonis/cms-ui/offer-surface";
import { endedSampleData, sampleActions, sampleData } from "@elkdonis/cms-ui/offer-templates/sample";
import type { TemplateData, TemplateId } from "@elkdonis/cms-ui/offer-templates/types";

// One template, alone on the screen, with the sample site. The gallery shows
// these routes in frames; the look comes from the query string:
//   ?ft=para|gazette|quiet|marquee|ledger|rite  &icons=things|marks|stamps|glyph
//   &tint=on|off  &mark=inline|thumb|box  &sheet=natural|level (phone sheet height)
function Inner({ template, children }: { template: TemplateId; children: (data: TemplateData) => React.ReactNode }) {
  const q = useSearchParams();
  const look: Partial<SurfaceLook> = {};
  const ft = q.get("ft");
  if (ft) look.font = ft as SurfaceLook["font"];
  const icons = q.get("icons");
  if (icons) look.icons = icons as SurfaceLook["icons"];
  const mark = q.get("mark");
  if (mark) look.mark = mark as SurfaceLook["mark"];
  if (q.get("tint") === "off") look.tint = false;
  const sheet = q.get("sheet");
  if (sheet === "level" || sheet === "natural") look.sheet = sheet;
  const ended = q.get("ended") === "1"; // sandbox: the sample's event and series dates move into the past
  const key = JSON.stringify(look) + (ended ? "|ended" : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = React.useMemo(() => (ended ? endedSampleData(sampleData(template, look)) : sampleData(template, look)), [template, key]);
  return (
    <div className="ot-frame">
      <OfferSurfaceRoot data={data} actions={sampleActions}>
        {children(data)}
      </OfferSurfaceRoot>
    </div>
  );
}

/** Client-only wrapper: use it from a "use client" file (it takes a function child). */
export function TemplateFrame(props: { template: TemplateId; children: (data: TemplateData) => React.ReactNode }) {
  return (
    <React.Suspense fallback={null}>
      <Inner {...props} />
    </React.Suspense>
  );
}
