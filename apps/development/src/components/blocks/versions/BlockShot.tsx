"use client";

import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Render, type Config } from "@puckeditor/core";
import { themeList, themeStyle } from "@/lib/theme-store";

// ============================================================================
// A still picture of one version: the block drawn at full width (1200) and
// scaled down to `width`, under the theme that version was made with. Used for
// the small dots in History and for the big preview and Compare. It mounts only
// while on screen (thumbnails are many).
// ============================================================================

const INNER_W = 1200;

class Safe extends Component<{ children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() {
    return { bad: true };
  }
  render() {
    return this.state.bad ? <div style={{ padding: 24, font: "13px system-ui", color: "#7a1f1f" }}>This version could not be drawn.</div> : this.props.children;
  }
}

export function BlockShot({ config, doc, theme, width, height, lazy }: { config: Config; doc: unknown; theme: string | null; width: number; height?: number; lazy?: boolean }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(!lazy);
  const [h, setH] = useState(120);
  const scale = width / INNER_W;

  useEffect(() => {
    if (!lazy || !outer.current) return;
    const io = new IntersectionObserver((es) => setSeen(es.some((e) => e.isIntersecting)), { rootMargin: "300px" });
    io.observe(outer.current);
    return () => io.disconnect();
  }, [lazy]);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(Math.max(40, el.offsetHeight * scale)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [seen, scale]);

  const t = theme ? themeList().find((x) => x.id === theme) : undefined;
  const box: CSSProperties = { width, height: height ?? Math.min(h, 420), overflow: "hidden", position: "relative", background: "#fff" };
  return (
    <div ref={outer} style={box}>
      {seen ? (
        <div ref={inner} style={{ width: INNER_W, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
          <div style={themeStyle(t)}>
            <Safe>
              <Render config={config} data={doc as never} />
            </Safe>
          </div>
        </div>
      ) : null}
    </div>
  );
}
