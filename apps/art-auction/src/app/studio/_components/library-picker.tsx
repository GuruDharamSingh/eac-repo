"use client";

import * as React from "react";
import { toast } from "sonner";
import type { UploadedImage } from "@elkdonis/studio-ui";
import { ContentLibrary } from "@elkdonis/content/ui";
import "@elkdonis/content/content.css";

/**
 * "Choose from your files" for the artwork form's Images section: the one Library component, in an inline
 * panel (the form already sits in a modal dialog, so no second layer). A picked file is stored by its URL as
 * a link, never copied (CONTRACT 11.3); the first image is the cover by the form's own rule.
 * Sources: "My files" always (every seller has one, resolved server-side from the session); a page that
 * knows more (an org folder) can pass `sources`.
 */
const MY_FILES = [{ key: "mine", label: "My files" }];

export function LibraryPicker({
  images,
  onChange,
  max = 12,
  sources = MY_FILES,
}: {
  images: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  max?: number;
  sources?: Array<{ key: string; label: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const pickedUrls = React.useMemo(() => images.map((i) => i.url), [images]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {open ? "Close your files" : "Choose from your files"}
      </button>
      {open && (
        <div className="rounded-lg border border-border p-3">
          <ContentLibrary
            view="files"
            lockView
            mode="pickMany"
            accept="image/*"
            folders={{ endpoint: "/api/content/folders", sources }}
            upload={{ endpoint: "/api/content/upload" }}
            density="compact"
            picked={pickedUrls}
            onToggle={(item) => {
              const url = item.links.public ?? item.cover;
              if (!url) return;
              if (images.some((i) => i.url === url)) {
                onChange(images.filter((i) => i.url !== url));
                return;
              }
              if (images.length >= max) {
                toast.error(`A listing holds up to ${max} photos.`);
                return;
              }
              onChange([...images, { url, alt: "" }]);
            }}
          />
        </div>
      )}
    </div>
  );
}
