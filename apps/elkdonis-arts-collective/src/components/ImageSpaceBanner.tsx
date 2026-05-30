"use client";

import { useEffect, useMemo, useState } from "react";

type ImageSpacesConfig = {
  intro_banner?: {
    path?: string;
    alt?: string;
  };
};

function buildImageSrc(path?: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  return `/api/media/file?path=${encodeURIComponent(path)}`;
}

export function ImageSpaceBanner() {
  const [cfg, setCfg] = useState<ImageSpacesConfig>({});

  useEffect(() => {
    fetch("/api/admin/site-config?key=image_spaces")
      .then((r) => r.json())
      .then((data) => {
        if (data.value && typeof data.value === "object") {
          setCfg(data.value as ImageSpacesConfig);
        }
      })
      .catch(() => {});
  }, []);

  const imagePath = cfg.intro_banner?.path;
  const imageAlt = cfg.intro_banner?.alt ?? "Elkdonis Arts Collective banner";
  const imageSrc = useMemo(() => buildImageSrc(imagePath), [imagePath]);

  return (
    <section className="image-space-banner" aria-label="Collective banner image">
      <div className="image-space-banner-inner">
        {imageSrc ? (
          <img className="image-space-banner-img" src={imageSrc} alt={imageAlt} loading="lazy" />
        ) : (
          <div className="image-space-banner-fallback" role="img" aria-label={imageAlt} />
        )}
      </div>
    </section>
  );
}
