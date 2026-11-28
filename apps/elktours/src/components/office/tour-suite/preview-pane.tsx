"use client";

import * as React from "react";

type Device = "phone" | "desktop";
const SIZE: Record<Device, { w: number; h: number }> = { phone: { w: 390, h: 780 }, desktop: { w: 1280, h: 820 } };

/**
 * "How visitors see it": the saved tour page in an iframe (editors see drafts there too), phone width as is,
 * desktop width scaled down to fit. `rev` changes after each successful save and reloads the frame.
 */
export function PreviewPane({ slug, rev }: { slug: string; rev: number }) {
  const [device, setDevice] = React.useState<Device>("phone");
  const box = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(360);

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { w, h } = SIZE[device];
  const scale = Math.min(1, width / w);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">How visitors see it</span>
        <span className="flex gap-1" role="group" aria-label="Preview size">
          {(["phone", "desktop"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={`rounded-full border px-3 py-0.5 text-xs ${device === d ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {d === "phone" ? "Phone" : "Desktop"}
            </button>
          ))}
        </span>
      </div>
      <div ref={box} className="w-full">
        {slug ? (
          <div className="mx-auto overflow-hidden rounded-md border border-border bg-background" style={{ width: w * scale, height: h * scale }}>
            <iframe
              key={`${device}-${rev}`}
              src={`/tours/${slug}`}
              title="The tour page"
              style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
            />
          </div>
        ) : (
          <p className="text-muted-foreground">Save the tour to see its page.</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Shows the saved tour; updates on each save.</p>
    </div>
  );
}
