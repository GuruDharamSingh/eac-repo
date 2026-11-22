"use client";

/**
 * JoinWorkshopModal — unified flow for joining a workshop.
 *
 * Two modes driven by the workshop's price:
 *   - Free (price null/0): one-click RSVP via /api/workshops/[id]/join,
 *     confirmation screen.
 *   - Paid: collects name/email/notes, posts to the same endpoint, then
 *     shows the eTransfer instructions returned by the server (composed
 *     via @elkdonis/commerce/etransfer).
 *
 * Visual chrome uses Mantine Modal for consistency with the rest of
 * inner-gathering; the inner content is plain HTML so we can slowly
 * migrate the app off Mantine.
 */

import { useEffect, useState } from "react";
import { Modal } from "@mantine/core";
import { Calendar, Check, Clock, Copy, MapPin, Send, Sparkles, Video } from "lucide-react";

export interface JoinWorkshopModalWorkshop {
  id: string;
  title: string;
  price?: number | string | null;
  currency?: string | null;
  scheduledAt?: Date | string | null;
  durationMinutes?: number | null;
  location?: string | null;
  isOnline?: boolean | null;
}

export interface JoinWorkshopModalProps {
  workshop: JoinWorkshopModalWorkshop;
  opened: boolean;
  onClose: () => void;
  user?: { id: string; email: string; displayName?: string | null } | null;
  onJoined?: (result: JoinResult) => void;
}

type JoinResult =
  | { kind: "free"; joined: true; workshop: { id: string; title: string } }
  | {
      kind: "paid";
      workshop: { id: string; title: string };
      amountMinor: number;
      currency: string;
      payment: {
        kind: "etransfer_instructions";
        payoutEmail: string;
        reference: string;
        bodyText: string;
        dueAt: string;
      };
    };

function formatPrice(value: number | string | null | undefined, currency: string): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "Free";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(n);
}

function formatDate(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return null;
  }
}

export function JoinWorkshopModal({
  workshop,
  opened,
  onClose,
  user,
  onJoined,
}: JoinWorkshopModalProps) {
  const currency = (workshop.currency ?? "CAD").toUpperCase();
  const isFree = !Number.isFinite(Number(workshop.price ?? 0)) || Number(workshop.price ?? 0) <= 0;

  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset state when the modal closes
  useEffect(() => {
    if (!opened) {
      setName(user?.displayName ?? "");
      setEmail(user?.email ?? "");
      setNotes("");
      setSubmitting(false);
      setError(null);
      setResult(null);
      setCopied(false);
    }
  }, [opened, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workshops/${encodeURIComponent(workshop.id)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: name,
          contactEmail: email,
          notes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error("Please sign in to join this workshop.");
        }
        throw new Error(data.error ?? "Could not join — please try again.");
      }
      const data: JoinResult = await res.json();
      setResult(data);
      onJoined?.(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyReference(reference: string) {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const scheduledDisplay = formatDate(workshop.scheduledAt);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton
      centered
      size="lg"
      radius={4}
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
      title={null}
      classNames={{ body: "join-workshop-modal__body" }}
      styles={{ body: { padding: 0 } }}
    >
      <div className="jwm">
        {/* Header */}
        <header className="jwm__header">
          <p className="jwm__eyebrow">
            {result ? (isFree ? "You're in" : "Almost there") : "Join Workshop"}
          </p>
          <h2 className="jwm__title">{workshop.title}</h2>
          {!result && (
            <ul className="jwm__meta">
              {scheduledDisplay && (
                <li>
                  <Calendar size={12} />
                  <span>{scheduledDisplay}</span>
                </li>
              )}
              {workshop.durationMinutes && (
                <li>
                  <Clock size={12} />
                  <span>{workshop.durationMinutes} min</span>
                </li>
              )}
              {workshop.isOnline ? (
                <li>
                  <Video size={12} />
                  <span>Online</span>
                </li>
              ) : workshop.location ? (
                <li>
                  <MapPin size={12} />
                  <span>{workshop.location}</span>
                </li>
              ) : null}
              <li className="jwm__price">{formatPrice(workshop.price, currency)}</li>
            </ul>
          )}
        </header>

        {/* Body */}
        <div className="jwm__content">
          {!result && (
            <form className="jwm__form" onSubmit={handleSubmit}>
              {isFree ? (
                <p className="jwm__lede">
                  Confirm your spot and you&rsquo;ll be added to the workshop. We&rsquo;ll
                  use the email on file for any updates.
                </p>
              ) : (
                <p className="jwm__lede">
                  Send your details and we&rsquo;ll generate Interac eTransfer instructions.
                  Your spot is held for 7 days while we wait for payment.
                </p>
              )}

              {/* Paid mode collects contact info; free mode reuses the session. */}
              {!isFree && (
                <>
                  <label className="jwm__field">
                    <span className="jwm__label">Full name</span>
                    <input
                      type="text"
                      className="jwm__input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="jwm__field">
                    <span className="jwm__label">Email</span>
                    <input
                      type="email"
                      className="jwm__input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </label>
                </>
              )}

              <label className="jwm__field">
                <span className="jwm__label">
                  Notes <span className="jwm__optional">(optional)</span>
                </span>
                <textarea
                  className="jwm__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything we should know — accessibility, schedule, intent…"
                />
              </label>

              {error && (
                <p className="jwm__error" role="alert">
                  {error}
                </p>
              )}

              {!user ? (
                <p className="jwm__signin">
                  You need to be signed in to join.{" "}
                  <a href={`/login?next=/workshops/${encodeURIComponent(workshop.id)}`}>
                    Sign in
                  </a>
                </p>
              ) : (
                <button
                  type="submit"
                  className="jwm__submit"
                  disabled={submitting || !email}
                >
                  {submitting ? (
                    "Sending…"
                  ) : isFree ? (
                    <>
                      <Check size={14} />
                      Confirm my spot
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Generate payment instructions
                    </>
                  )}
                </button>
              )}
            </form>
          )}

          {/* Free success */}
          {result?.kind === "free" && (
            <div className="jwm__success">
              <div className="jwm__success-icon" aria-hidden="true">
                <Sparkles size={22} />
              </div>
              <h3 className="jwm__success-title">You&rsquo;re in.</h3>
              <p className="jwm__success-body">
                We&rsquo;ve added you to <strong>{result.workshop.title}</strong>. You&rsquo;ll
                see reminders here and in your email.
              </p>
              <button type="button" className="jwm__submit" onClick={onClose}>
                Done
              </button>
            </div>
          )}

          {/* Paid: eTransfer instructions */}
          {result?.kind === "paid" && (
            <div className="jwm__payment">
              <p className="jwm__lede">
                Send an Interac eTransfer using the details below. Your spot is held until{" "}
                <strong>{new Date(result.payment.dueAt).toLocaleDateString()}</strong>.
              </p>

              <dl className="jwm__pay-grid">
                <div>
                  <dt>Send to</dt>
                  <dd>
                    <code>{result.payment.payoutEmail}</code>
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>
                    {new Intl.NumberFormat("en-CA", {
                      style: "currency",
                      currency: result.currency,
                    }).format(result.amountMinor / 100)}
                  </dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd className="jwm__reference">
                    <code>{result.payment.reference}</code>
                    <button
                      type="button"
                      className="jwm__copy"
                      onClick={() => copyReference(result.payment.reference)}
                      aria-label="Copy reference"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </dd>
                </div>
              </dl>

              <pre className="jwm__instructions">{result.payment.bodyText}</pre>

              <p className="jwm__hint">
                A confirmation email is on its way. Reply to it with any questions.
              </p>

              <button type="button" className="jwm__submit" onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
