"use client";

import { useActionState, useEffect, useRef } from "react";
import { postToElkdonis, type PostState } from "@/app/hub/(tabs)/elkdonis/actions";

const INITIAL: PostState = { ok: false, message: null };

/**
 * A small composer for one of the Elkdonis categories. Posts straight into the
 * forum through createTopic, so the forum's own rules apply (rate limit,
 * post_role). `withLink` adds an optional URL field — for cross-post
 * suggestions, where the thing being suggested usually lives elsewhere.
 */
export function ComposeForm({
  feed,
  submitLabel,
  titlePlaceholder,
  textPlaceholder,
  withLink = false,
  compact = false,
}: {
  feed: string;
  submitLabel: string;
  titlePlaceholder: string;
  textPlaceholder: string;
  withLink?: boolean;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(postToElkdonis, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="ekh-form">
      <input type="hidden" name="feed" value={feed} />
      <label className="ekh-sr" htmlFor={`${feed}-title`}>Title</label>
      <input
        id={`${feed}-title`}
        name="title"
        required
        minLength={2}
        maxLength={200}
        placeholder={titlePlaceholder}
        className="ekh-input"
      />
      <label className="ekh-sr" htmlFor={`${feed}-text`}>Details</label>
      <textarea
        id={`${feed}-text`}
        name="text"
        required={!withLink}
        rows={compact ? 2 : 3}
        placeholder={textPlaceholder}
        className="ekh-input"
      />
      {withLink && (
        <>
          <label className="ekh-sr" htmlFor={`${feed}-link`}>Link</label>
          <input
            id={`${feed}-link`}
            name="link"
            type="url"
            inputMode="url"
            placeholder="https:// (optional)"
            className="ekh-input"
          />
        </>
      )}
      <div className="ekh-form__foot">
        <button type="submit" className="ekh-btn ekh-btn--gold" disabled={pending}>
          {pending ? "Posting…" : submitLabel}
        </button>
        {state.message && (
          <p className={state.ok ? "ekh-note ekh-note--ok" : "ekh-note ekh-note--err"} role="status">
            {state.message}{" "}
            {state.href && (
              <a href={state.href} target="_blank" rel="noopener">View it →</a>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
