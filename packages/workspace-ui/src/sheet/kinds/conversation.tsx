"use client";
import { useState } from "react";
import { useWorkspace } from "../../store";
import { CommonFields, Field, Prompt, type DoProps, type KindDef } from "./shared";

// A small local thread: kept in component state only.
function ConversationDo({ step }: DoProps) {
  const { viewer } = useWorkspace();
  const [posts, setPosts] = useState<{ by: string; text: string }[]>([]);
  const [text, setText] = useState("");
  const post = () => { if (text.trim()) { setPosts([...posts, { by: viewer.name, text: text.trim() }]); setText(""); } };
  return (
    <div>
      <Prompt step={step} />
      <ul className="ws-sh-thread">
        {posts.length === 0 && <li className="ws-sh-meta">No messages yet.</li>}
        {posts.map((p, i) => <li key={i}><strong>{p.by}</strong> {p.text}</li>)}
      </ul>
      <Field label="Say something">
        {(id) => <input id={id} className="ws-sh-input" type="text" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") post(); }} />}
      </Field>
      <button type="button" className="ws-sh-btn" disabled={!text.trim()} onClick={post}>Post</button>
    </div>
  );
}

export const conversation: KindDef = {
  label: "Conversation",
  Do: (p) => <ConversationDo {...p} />,
  Edit: (p) => <CommonFields {...p} />,
};
