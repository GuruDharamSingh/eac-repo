"use client";

import { TemplateShell } from "@elkdonis/cms-ui/offer-templates/shell";
import { TemplateFrame } from "@/offer-templates/Frame";

export function Probe() {
  return (
    <TemplateFrame template="profile">
      {(data) => (
        <TemplateShell data={data} template="profile">
          <div style={{ padding: 24 }}>The template draws here.</div>
        </TemplateShell>
      )}
    </TemplateFrame>
  );
}
