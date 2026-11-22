"use client";
import { useId, useState } from "react";
import { useWorkspace } from "../store";
import "./sheet.css";

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

/** The group thread. Newest at the bottom. Optionally controlled, so People can prefill "@Name ". */
export function Messages({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const { messages, people, sendMessage, viewer } = useWorkspace();
  const [own, setOwn] = useState("");
  const text = value ?? own;
  const set = onChange ?? setOwn;
  const id = useId();
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    sendMessage(t);
    set("");
  };
  return (
    <section className="ws-hm-block" aria-labelledby={`${id}-h`}>
      <h3 className="ws-sh-sub" id={`${id}-h`}>Messages</h3>
      {messages.length === 0 ? (
        <p className="ws-sh-meta">No messages yet. Anyone in the group can post.</p>
      ) : (
        <ul className="ws-hm-thread" aria-live="polite">
          {messages.map((m) => {
            const p = people.find((x) => x.id === m.by);
            return (
              <li key={m.id} className={`ws-hm-msg${m.by === viewer.id ? " is-mine" : ""}`}>
                <div className="ws-hm-msgby"><strong>{p?.name ?? "Someone"}</strong> · {fmt(m.at)}</div>
                <div>{m.text}</div>
              </li>
            );
          })}
        </ul>
      )}
      <form className="ws-hm-compose" onSubmit={send}>
        <label htmlFor={`${id}-t`} className="ws-sh-sr">Message to the group</label>
        <input id={`${id}-t`} className="ws-sh-input" type="text" value={text} placeholder="Write to the group" onChange={(e) => set(e.target.value)} />
        <button type="submit" className="ws-sh-btn ws-sh-primary" disabled={!text.trim()}>Send</button>
      </form>
    </section>
  );
}
export default Messages;
