"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { withBase } from "@/lib/base-path";

/**
 * An in-page PDF reader drawn with pdf.js, so it works on phones too (mobile
 * browsers will not show a PDF inside a frame). Pages are drawn to canvases
 * as they scroll into view, and it opens at `startPage`.
 *
 * pdf.js's worker, WASM decoders (JBig2 — scanned pages) and standard fonts
 * are served from public/pdfjs/<version>/, copied from node_modules/pdfjs-dist
 * (keep the folder name equal to the installed version).
 */

const PDFJS_VERSION = "5.7.284";
const asset = (p: string) => withBase(`/pdfjs/${PDFJS_VERSION}/${p}`);

type PdfDoc = {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(o: { scale: number }): { width: number; height: number };
    render(o: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: unknown }): { promise: Promise<void> };
  }>;
  destroy(): Promise<void>;
};

let libPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.min.mjs")> | null = null;
function loadLib() {
  if (!libPromise) {
    libPromise = import("pdfjs-dist/legacy/build/pdf.min.mjs").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = asset("pdf.worker.min.mjs");
      return lib;
    });
  }
  return libPromise;
}

export function PdfReader({
  url,
  title,
  startPage,
  onClose,
}: {
  url: string;
  title: string;
  startPage: number;
  onClose: () => void;
}) {
  const [doc, setDoc] = React.useState<PdfDoc | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState(startPage);
  const scroller = React.useRef<HTMLDivElement>(null);
  const pageRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  React.useEffect(() => {
    let cancelled = false;
    let loaded: PdfDoc | null = null;
    setDoc(null);
    setError(null);
    loadLib()
      .then((lib) =>
        lib.getDocument({
          url,
          wasmUrl: asset("wasm/"),
          standardFontDataUrl: asset("standard_fonts/"),
          withCredentials: true,
        }).promise
      )
      .then((d) => {
        loaded = d as unknown as PdfDoc;
        if (!cancelled) setDoc(loaded);
      })
      .catch((err) => {
        console.error("[reader]", err);
        if (!cancelled) setError("This file could not be opened here.");
      });
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [url]);

  // Jump to the starting page once the page boxes exist.
  React.useEffect(() => {
    if (!doc) return;
    const n = Math.min(Math.max(1, startPage), doc.numPages);
    requestAnimationFrame(() => {
      const el = pageRefs.current[n - 1];
      if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 8;
    });
  }, [doc, startPage]);

  const go = (n: number) => {
    if (!doc) return;
    const target = Math.min(Math.max(1, n), doc.numPages);
    const el = pageRefs.current[target - 1];
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
  };

  // Track which page is in view for the counter.
  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    const mid = box.scrollTop + box.clientHeight / 3;
    let n = 1;
    pageRefs.current.forEach((el, i) => {
      if (el && el.offsetTop <= mid) n = i + 1;
    });
    setCurrent(n);
  };

  return (
    <div className="pdf-reader">
      <div className="pdf-reader__bar">
        <span className="pdf-reader__title">{title}</span>
        <span className="pdf-reader__tools">
          {doc && (
            <>
              <button type="button" className="btn btn--small" onClick={() => go(current - 1)} disabled={current <= 1} aria-label="Previous page">
                <ChevronLeft size={13} />
              </button>
              <span className="pdf-reader__count">p. {current} / {doc.numPages}</span>
              <button type="button" className="btn btn--small" onClick={() => go(current + 1)} disabled={current >= doc.numPages} aria-label="Next page">
                <ChevronRight size={13} />
              </button>
            </>
          )}
          <a className="btn btn--small" href={`${url}#page=${current}`} target="_blank" rel="noreferrer" aria-label="Open in a new tab">
            <ExternalLink size={13} />
          </a>
          <button type="button" className="btn btn--small" onClick={onClose} aria-label="Close the reader">
            <X size={13} />
          </button>
        </span>
      </div>
      <div className="pdf-reader__pages" ref={scroller} onScroll={onScroll}>
        {error && <p className="empty">{error}</p>}
        {!doc && !error && <p className="empty">Opening…</p>}
        {doc &&
          Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage
              key={i}
              doc={doc}
              number={i + 1}
              root={scroller}
              eager={Math.abs(i + 1 - startPage) <= 1}
              refFn={(el) => {
                pageRefs.current[i] = el;
              }}
            />
          ))}
      </div>
    </div>
  );
}

/** One page: a sized placeholder, drawn when it nears the viewport. */
function PdfPage({
  doc,
  number,
  root,
  eager,
  refFn,
}: {
  doc: PdfDoc;
  number: number;
  root: React.RefObject<HTMLDivElement | null>;
  eager: boolean;
  refFn: (el: HTMLDivElement | null) => void;
}) {
  const box = React.useRef<HTMLDivElement | null>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = React.useState(eager);
  const [ratio, setRatio] = React.useState(1.294); // US letter until measured
  const drawn = React.useRef(false);

  React.useEffect(() => {
    if (visible || !box.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { root: root.current, rootMargin: "600px 0px" }
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [visible, root]);

  React.useEffect(() => {
    if (!visible || drawn.current || !canvas.current || !box.current) return;
    drawn.current = true;
    let cancelled = false;
    doc.getPage(number).then(async (page) => {
      if (cancelled || !canvas.current || !box.current) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const cssWidth = box.current.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, canvas: c, viewport }).promise;
    }).catch((err) => console.error(`[reader] page ${number}:`, err));
    return () => {
      cancelled = true;
    };
  }, [visible, doc, number]);

  return (
    <div
      className="pdf-reader__page"
      ref={(el) => {
        box.current = el;
        refFn(el);
      }}
      style={{ aspectRatio: `1 / ${ratio}` }}
      aria-label={`Page ${number}`}
    >
      <canvas ref={canvas} />
    </div>
  );
}
