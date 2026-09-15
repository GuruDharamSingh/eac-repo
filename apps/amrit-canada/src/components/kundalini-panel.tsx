"use client";

import { useEffect, useRef } from "react";
import type PaperModule from "paper";

/**
 * Two mirrored wave fields (independent paper.js projects, same canvas
 * pattern as a single-canvas "multiple projects" setup -- two separate
 * PaperScope instances don't both end up wired to render) meeting in a
 * bright band down the middle, with the word reading top-to-bottom in dark
 * ink where they meet.
 */
const WORD = "KUNDALINI";
const PATH_COUNTS = 13;
const PATH_POINTS = 15;
const SPEED = 1.4;
const OFFSET = 6;
const DELAY = 0.9;
const FREQUENCY = [0, -26, 44, -44, -30, 30, 0, -26, 44, -44, -30, 30, -26, 44, -44, -30, 30];

type Side = "left" | "right";

interface KundaliniPanelProps {
  /** The vertical word only fits a tall, narrow box -- off by default now that this lives in the short, wide header banner. */
  showWord?: boolean;
}

export function KundaliniPanel({ showWord = false }: KundaliniPanelProps) {
  const leftBoxRef = useRef<HTMLDivElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightBoxRef = useRef<HTMLDivElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    const cleanups: Array<() => void> = [];

    import("paper").then((mod) => {
      if (cancelled) return;
      const paper = (mod.default ?? mod) as typeof PaperModule;

      function createField(box: HTMLDivElement, canvas: HTMLCanvasElement, side: Side) {
        paper.setup(canvas);
        const project = paper.project;
        const view = project.view;
        let mid = 0;
        let paths: paper.Path[] = [];

        function buildPaths() {
          project.activate();
          const w = box.clientWidth || 1;
          const h = box.clientHeight || 1;
          canvas.width = w;
          canvas.height = h;
          view.viewSize = new paper.Size(w, h);

          mid = side === "left" ? w * 0.42 : w * 0.58;
          const farEdgeX = side === "left" ? w + 10 : -10;

          project.activeLayer.removeChildren();
          paths = [];

          for (let i = 0; i < PATH_COUNTS; i++) {
            const p = new paper.Path();
            p.add(new paper.Point(farEdgeX, -10));
            p.add(new paper.Point(mid, -10));
            for (let s = 0; s < PATH_POINTS - 1; s++) {
              p.add(new paper.Point(mid + FREQUENCY[s], (h / (PATH_POINTS - 1)) * s));
            }
            p.add(new paper.Point(mid, h + 10));
            p.add(new paper.Point(farEdgeX, h + 10));
            p.closed = true;
            p.strokeWidth = 1.5;

            if (i === 0) {
              p.fillColor = new paper.Color(0.99, 0.965, 0.91, 1);
              p.strokeColor = null;
            } else {
              p.fillColor = null;
              const fade = 0.55 - (i / PATH_COUNTS) * 0.45;
              p.strokeColor = new paper.Color(0.96, 0.77, 0.19, fade);
            }
            p.smooth();
            paths.push(p);
          }
        }

        buildPaths();
        const ro = new ResizeObserver(() => buildPaths());
        ro.observe(box);
        cleanups.push(() => ro.disconnect());
        cleanups.push(() => project.remove());

        return {
          update(time: number) {
            project.activate();
            for (let pi = 0; pi < PATH_COUNTS; pi++) {
              const segments = paths[pi].segments;
              for (let s = 0; s < PATH_POINTS; s++) {
                const segment = segments[2 + s];
                if (!segment) continue;
                const value = s % 2 ? -1 : 1;
                const f = FREQUENCY[s] || 0;
                segment.point.x =
                  mid + Math.sin((time + s * DELAY) * SPEED) * (f * value + pi * OFFSET * value);
              }
              paths[pi].smooth();
            }
            view.update();
          },
        };
      }

      const leftBox = leftBoxRef.current;
      const leftCanvas = leftCanvasRef.current;
      const rightBox = rightBoxRef.current;
      const rightCanvas = rightCanvasRef.current;
      if (!leftBox || !leftCanvas || !rightBox || !rightCanvas) return;

      const left = createField(leftBox, leftCanvas, "left");
      const right = createField(rightBox, rightCanvas, "right");

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) {
        let start: number | null = null;
        const frame = (now: number) => {
          if (start === null) start = now;
          const t = (now - start) / 1000;
          left.update(t);
          right.update(t);
          rafId = requestAnimationFrame(frame);
        };
        rafId = requestAnimationFrame(frame);
      }
    });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div
        ref={leftBoxRef}
        className="relative flex-1 overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #10151a 0%, #1c262c 22%, #36454f 55%, #4a2f1c 88%, #7a3616 100%)",
        }}
      >
        <canvas ref={leftCanvasRef} className="absolute inset-0 block" />
      </div>
      <div
        ref={rightBoxRef}
        className="relative flex-1 overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #7a3616 0%, #4a2f1c 12%, #36454f 45%, #1c262c 78%, #10151a 100%)",
        }}
      >
        <canvas ref={rightCanvasRef} className="absolute inset-0 block" />
      </div>
      {showWord && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 select-none font-serif font-bold lg:block"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "upright",
            color: "#241a12",
            letterSpacing: "0.02em",
            fontSize: "clamp(42px, 5.5vw, 108px)",
          }}
        >
          {WORD}
        </span>
      )}
    </div>
  );
}
