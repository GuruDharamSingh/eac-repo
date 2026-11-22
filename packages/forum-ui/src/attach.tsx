"use client";
import * as React from "react";

// ============================================================================
// The attachment picker for the start-a-topic forms and the reply form (opt-in:
// ForumComposeOptions.attachments). One small client island. A person picks photos or
// videos; each file goes to the host's upload route (default /api/upload/forum, a
// multipart POST of `file` and `audience`) as soon as it is picked; each finished
// upload becomes a hidden `attachment` field holding JSON {kind,url,meta:{width,height}},
// which forum-ui's form action reads. Nothing here posts the form itself.
//
// Two shapes, from the design (pack screens 21 and 20):
//   "compose"  a 2-column grid of tiles with a corner x, and a dashed "+ Add photos or video"
//   "reply"    a row of 64px thumbs with a corner x, and a round "+" button
//
// Rules the design asks for: pending items can be removed; an item that is still
// uploading blocks the post; a reply needs text or at least one attachment (the
// textarea's `required` is lifted while one is attached).
// ============================================================================

export interface AttachPickerProps {
  variant: "compose" | "reply";
  /** Where files are posted. Default "/api/upload/forum". */
  uploadUrl?: string;
  /** Label for the field (compose shape). */
  label?: string;
}

interface Item {
  key: string;
  name: string;
  kind: "image" | "video";
  preview: string;
  status: "uploading" | "done" | "error";
  url?: string;
  width?: number;
  height?: number;
  error?: string;
}

let counter = 0;
const MAX_ITEMS = 12;

export function AttachPicker({ variant, uploadUrl = "/api/upload/forum", label = "Photos & video · optional" }: AttachPickerProps) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [note, setNote] = React.useState<string | null>(null);
  const root = React.useRef<HTMLDivElement>(null);
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const form = () => root.current?.closest("form") ?? null;
  const done = items.filter((i) => i.status === "done");
  const busy = items.some((i) => i.status === "uploading");

  // The form's rules: no posting while an upload is running; a reply may be attachments alone.
  React.useEffect(() => {
    const f = form();
    if (!f) return;
    const text = f.querySelector<HTMLTextAreaElement>("textarea[name=text]");
    const isReply = variant === "reply";
    const onSubmit = (e: Event) => {
      if (itemsRef.current.some((i) => i.status === "uploading")) {
        e.preventDefault();
        setNote("Wait for the upload to finish.");
      }
    };
    f.addEventListener("submit", onSubmit);
    if (isReply && text) text.required = done.length === 0;
    return () => {
      f.removeEventListener("submit", onSubmit);
      if (isReply && text) text.required = true;
    };
  }, [variant, done.length]);

  React.useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const audience = (): string => {
    const f = form();
    const picked = f?.querySelector<HTMLInputElement>("input[name=audience]:checked");
    return picked?.value ?? f?.getAttribute("data-audience") ?? "everyone";
  };

  async function upload(file: File, key: string) {
    const body = new FormData();
    body.append("file", file);
    body.append("audience", audience());
    try {
      const res = await fetch(uploadUrl, { method: "POST", body, credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as { url?: string; kind?: string; width?: number; height?: number; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
      setItems((cur) => cur.map((i) => (i.key === key ? { ...i, status: "done", url: json.url, width: json.width, height: json.height, kind: json.kind === "video" ? "video" : "image" } : i)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setItems((cur) => cur.map((i) => (i.key === key ? { ...i, status: "error", error: msg } : i)));
      setNote(msg);
    }
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setNote(null);
    const room = MAX_ITEMS - itemsRef.current.length;
    const picked = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/")).slice(0, Math.max(room, 0));
    if (files.length > picked.length) setNote("Photos and videos only, up to 12 in all.");
    const fresh: Item[] = picked.map((f) => ({
      key: `a${++counter}`, name: f.name, kind: f.type.startsWith("video/") ? "video" : "image", preview: URL.createObjectURL(f), status: "uploading",
    }));
    setItems((cur) => [...cur, ...fresh]);
    picked.forEach((f, i) => void upload(f, fresh[i]!.key));
  }

  function remove(key: string) {
    setItems((cur) => {
      const gone = cur.find((i) => i.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return cur.filter((i) => i.key !== key);
    });
  }

  const tile = (i: Item) => (
    <div key={i.key} className={`gf-attach-item gf-attach-item--${variant} is-${i.status}`}>
      {i.kind === "image" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={i.preview} alt="" />
      ) : variant === "compose" ? (
        <video src={i.preview} muted />
      ) : (
        <span className="gf-attach-play" aria-hidden>▶</span>
      )}
      {i.status === "uploading" && <span className="gf-attach-state" role="status">Uploading…</span>}
      {i.status === "error" && <span className="gf-attach-state gf-attach-state--error" title={i.error}>Failed</span>}
      <button type="button" className="gf-attach-x" onClick={() => remove(i.key)} aria-label={`Remove ${i.name}`}>×</button>
    </div>
  );

  const hidden = done.map((i) => (
    <input
      key={i.key}
      type="hidden"
      name="attachment"
      value={JSON.stringify({ kind: i.kind, url: i.url, meta: { ...(i.width ? { width: i.width } : {}), ...(i.height ? { height: i.height } : {}) } })}
    />
  ));

  const input = <input type="file" accept="image/*,video/*" multiple onChange={onFiles} className="gf-attach-file" />;

  if (variant === "reply") {
    return (
      <div className="gf-attach gf-attach--reply" ref={root}>
        {items.length > 0 && <div className="gf-attach-thumbs">{items.map(tile)}</div>}
        {hidden}
        <label className="gf-attach-add gf-attach-add--round" title="Add photos or video" aria-label="Add photos or video">
          {input}+
        </label>
        {note && <span className="gf-attach-note" role="alert">{note}</span>}
      </div>
    );
  }
  return (
    <div className="gf-field gf-attach gf-attach--compose" ref={root}>
      <span className="gf-field-label">{label}</span>
      {items.length > 0 && <div className="gf-attach-grid">{items.map(tile)}</div>}
      {hidden}
      <label className="gf-attach-add">
        {input}+ Add photos or video
      </label>
      {note && <span className="gf-attach-note" role="alert">{note}</span>}
      {busy && <span className="gf-field-hint">Uploading…</span>}
    </div>
  );
}
