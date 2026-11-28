"use client";

import { useMemo, type ComponentType } from "react";
import "@elkdonis/cms-ui/offer-surface.css";
import "@elkdonis/cms-ui/offer-templates/shell.css";
import "@elkdonis/cms-ui/offer-templates/event.css";
import "@elkdonis/cms-ui/offer-templates/announcement.css";
import "@elkdonis/cms-ui/offer-templates/note.css";
import "@elkdonis/cms-ui/offer-templates/service.css";
import "@elkdonis/cms-ui/offer-templates/artwork.css";
import "@elkdonis/cms-ui/offer-templates/series.css";
import "@elkdonis/cms-ui/offer-templates/essay.css";
import "@elkdonis/cms-ui/offer-templates/feature.css";
import "@elkdonis/cms-ui/offer-templates/document.css";
import "@elkdonis/cms-ui/offer-templates/gazette.css";
import "@elkdonis/cms-ui/offer-templates/profile.css";
import { OfferProfilePage, OfferSurfaceRoot, type SurfaceSiteData } from "@elkdonis/cms-ui/offer-surface";
import { AnnouncementTemplate } from "@elkdonis/cms-ui/offer-templates/announcement";
import { ArtworkTemplate } from "@elkdonis/cms-ui/offer-templates/artwork";
import { DocumentTemplate } from "@elkdonis/cms-ui/offer-templates/document";
import { EssayTemplate } from "@elkdonis/cms-ui/offer-templates/essay";
import { EventTemplate } from "@elkdonis/cms-ui/offer-templates/event";
import { FeatureTemplate } from "@elkdonis/cms-ui/offer-templates/feature";
import { GazetteTemplate } from "@elkdonis/cms-ui/offer-templates/gazette";
import { NoteTemplate } from "@elkdonis/cms-ui/offer-templates/note";
import { ProfileTemplate } from "@elkdonis/cms-ui/offer-templates/profile";
import { SeriesTemplate } from "@elkdonis/cms-ui/offer-templates/series";
import { ServiceTemplate } from "@elkdonis/cms-ui/offer-templates/service";
import type { TemplateData, TemplateId, TemplateProps } from "@elkdonis/cms-ui/offer-templates/types";
import { makeOfferActions } from "./offer-actions";

const VIEWS: Record<TemplateId, ComponentType<TemplateProps>> = {
  event: EventTemplate,
  announcement: AnnouncementTemplate,
  note: NoteTemplate,
  service: ServiceTemplate,
  artwork: ArtworkTemplate,
  series: SeriesTemplate,
  essay: EssayTemplate,
  feature: FeatureTemplate,
  document: DocumentTemplate,
  gazette: GazetteTemplate,
  profile: ProfileTemplate,
};

function isTemplateData(d: SurfaceSiteData | TemplateData): d is TemplateData {
  return Array.isArray((d as TemplateData).pieces) && typeof (d as TemplateData).extras === "object";
}

/**
 * The single-offer page of an org site, in the surface design. Client
 * component: the surface stack lives in the browser and mirrors itself to
 * `?surface=`. Data comes from `loadOfferPage` (lib/offer-load): with a
 * `template` the page is drawn through that template (the featured piece's own,
 * or "profile" for the second page); without one, the first-pass profile page.
 */
export function OfferSitePage({
  data,
  template,
  signInHref,
  writingHref,
}: {
  data: SurfaceSiteData | TemplateData;
  template?: TemplateId;
  signInHref?: string;
  writingHref?: string;
}) {
  const actions = useMemo(() => makeOfferActions(data.site.slug, data.owner.id), [data.site.slug, data.owner.id]);
  const View = template && isTemplateData(data) ? VIEWS[template] : null;
  return (
    <OfferSurfaceRoot data={data} actions={actions} signInHref={signInHref}>
      {View && isTemplateData(data) ? <View data={data} /> : <OfferProfilePage data={data} writingHref={writingHref} />}
    </OfferSurfaceRoot>
  );
}
