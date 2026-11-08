"use client";

import * as React from "react";
import { ExternalLink, Info, Maximize2, Minimize2, Repeat } from "lucide-react";
import { SurfaceFrame, useLayer, useSurface } from "@elkdonis/cms-ui/surface";
import {
  INSTAGRAM_RULES,
  fmtLong,
  fromZonedInput,
  kindGlyph,
  kindLabel,
  linkInBio,
  toZonedInput,
  type Outlet,
  type Piece,
  type Suggestion,
} from "@/lib/channel/model";
import { saveQuickSheetAction } from "@/lib/channel/actions";
import { useChannel } from "./context";
import type { QuickSpec } from "./quick-spec";
export type { QuickSpec } from "./quick-spec";
export { specFromSuggestion } from "./quick-spec";
import { sentences } from "./quick-spec";
import { OutletIcon } from "./icons";
import { Thumb } from "./bits";
import { outletLabel } from "./labels";

// ============================================================================
// Quick sheet (2c): fill a slot or a gap from wherever you are. A right-hand
// sheet (460 px); Expand widens it to 900 px with the outlets side by side.
// Saves a channel_deliveries draft, or schedules it. Nothing is sent: a
// scheduled delivery is a plan until the send path is switched on.
// ============================================================================

export function QuickSheet({ spec }: { spec: QuickSpec }) {
  const { model, piece: findPiece, scopeOrg, identity } = useChannel();
  const layer = useLayer();
  const surface = useSurface();
  const [wide, setWide] = React.useState(false);
  const [pieceKey, setPieceKey] = React.useState(spec.pieceKey);
  const piece = findPiece(pieceKey);
  const [quote, setQuote] = React.useState<string | null>(spec.quote ?? null);
  const [caption, setCaption] = React.useState(spec.caption ?? defaultCaption(piece, spec.outlet));
  const [alsoFb, setAlsoFb] = React.useState(false);
  const [when, setWhen] = React.useState(toZonedInput(spec.at, model.timeZone));
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<{ text: string; tone: "normal" | "error" } | null>(null);

  React.useEffect(() => {
    layer.setMeta({ size: wide ? "wide" : "standard" });
  }, [wide, layer]);

  const fb = model.outlets.find((o) => o.id === "facebook");
  const ig = model.outlets.find((o) => o.id === "instagram");
  const isIg = spec.outlet === "instagram";
  const igBlocked = isIg && ig?.left === 0;
  const preview = isIg ? linkInBio(caption) : { text: caption, swapped: false };
  const whenIso = when ? fromZonedInput(when, model.timeZone) : null;
  const places = 1 + (alsoFb ? 1 : 0);
  const weekday = whenIso ? new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: model.timeZone }).format(new Date(whenIso)) : null;
  const lines = piece ? sentences(piece.excerpt) : [];
  const who = identity(spec.identityId);

  async function save(schedule: boolean) {
    if (!piece) return;
    setBusy(true);
    setStatus(null);
    const r = await saveQuickSheetAction({
      pieceKey,
      identityId: spec.identityId,
      scopeOrg,
      outlet: spec.outlet,
      title: spec.title,
      caption,
      quote,
      alsoFacebook: alsoFb,
      at: whenIso,
      routineId: spec.routineId,
      deliveryId: spec.deliveryId ?? null,
      schedule,
    });
    setBusy(false);
    if (r.ok === false) {
      setStatus({ text: r.error, tone: "error" });
      return;
    }
    surface.connectors.onMutated?.();
    surface.pop();
  }

  const form = (
    <div className="chn-qs-form">
      <div className="chn-qs-piece">
        {piece ? <Thumb piece={piece} size={40} /> : null}
        <div>
          <small>
            {piece ? (
              <>
                <span aria-hidden>{kindGlyph(piece.kind)}</span> {kindLabel(piece.kind)}
                {piece.row[spec.outlet === "threads" ? "facebook" : (spec.outlet as "instagram")]?.state === "empty" ? ` · not on ${outletLabel(spec.outlet)} yet` : ""}
              </>
            ) : (
              "Choose a piece"
            )}
          </small>
          <label className="chn-qs-change">
            <span className="chn-sr">Piece</span>
            {/* Editing a saved draft keeps its piece: the draft is about that piece. */}
            <select value={pieceKey} onChange={(e) => setPieceKey(e.target.value)} disabled={Boolean(spec.deliveryId)}>
              {model.pieces.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {quote !== null && (
        <div className="chn-field">
          <label htmlFor="qs-quote">Quote, set on the card</label>
          <textarea id="qs-quote" rows={2} value={quote} onChange={(e) => setQuote(e.target.value)} />
          {lines.length > 1 && (
            <p className="chn-help">
              Taken from the piece.{" "}
              <button type="button" className="chn-linkbtn" onClick={() => setQuote(lines[(lines.indexOf(quote) + 1) % lines.length] ?? lines[0])}>
                Pick another line
              </button>
            </p>
          )}
        </div>
      )}

      {isIg && (
        <div className="chn-qs-card">
          {quote !== null ? (
            <div className="chn-quote-card" aria-label="Card preview">
              <p>{quote || "Your line here."}</p>
              <small>{piece?.title}</small>
            </div>
          ) : piece ? (
            <Thumb piece={piece} size={150} />
          ) : null}
          <ul className="chn-notes">
            <li>
              <Info size={13} aria-hidden /> {quote !== null ? "The card is laid out from the quote. Making the picture comes with sending; this is the layout." : INSTAGRAM_RULES.jpegNote}
            </li>
            <li>
              <Info size={13} aria-hidden /> {INSTAGRAM_RULES.linkNote}
            </li>
          </ul>
        </div>
      )}

      <div className="chn-field">
        <div className="chn-field-row">
          <label htmlFor="qs-caption">Caption</label>
          <small>
            {caption.length.toLocaleString()} / {INSTAGRAM_RULES.captionMax.toLocaleString()}
          </small>
        </div>
        <textarea id="qs-caption" rows={4} maxLength={INSTAGRAM_RULES.captionMax} value={caption} onChange={(e) => setCaption(e.target.value)} />
        {preview.swapped && <p className="chn-help">The link will be replaced with “link in bio” on Instagram.</p>}
      </div>

      <fieldset className="chn-field">
        <legend>Send to</legend>
        <label className="chn-check is-locked">
          <input type="checkbox" checked readOnly disabled={igBlocked} />
          <OutletIcon outlet={spec.outlet} size={16} /> {outletLabel(spec.outlet)}
          <small>{spec.routineId ? " · this slot" : who ? ` · as ${who.shortName}` : ""}</small>
        </label>
        {igBlocked && <p className="chn-help is-alert">Daily limit of 25 reached. Instagram is off until the oldest post is 24 hours old.</p>}
        {isIg && fb?.connected && (
          <label className="chn-check">
            <input type="checkbox" checked={alsoFb} onChange={(e) => setAlsoFb(e.target.checked)} />
            <OutletIcon outlet="facebook" size={16} /> Also post to Facebook <small> · with the link</small>
          </label>
        )}
      </fieldset>

      <div className="chn-field chn-qs-when">
        <label htmlFor="qs-when">When</label>
        <input id="qs-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <small>
          {whenIso ? fmtLong(whenIso, model.timeZone) : "Not placed yet"}
          {spec.routineName ? (
            <>
              {" "}
              · <Repeat size={11} aria-hidden /> From your {spec.routineName} routine
            </>
          ) : null}
        </small>
      </div>
    </div>
  );

  return (
    <SurfaceFrame
      kind="post"
      kicker={spec.kicker}
      title={spec.title}
      status={status ? status.text : model.ready ? "Saves to the queue. Nothing is sent from Channel yet." : "Needs migration 252 to save"}
      statusTone={status?.tone ?? "normal"}
      actions={[
        { label: "Save draft", onClick: () => save(false), disabled: busy || !piece },
        {
          label: whenIso ? (places > 1 ? `Schedule to ${places} places` : `Schedule for ${weekday}`) : "Choose when",
          primary: true,
          onClick: () => save(true),
          disabled: busy || !piece || !whenIso || igBlocked,
        },
      ]}
    >
      <div className="chn-qs" data-wide={wide ? "1" : "0"}>
        <div className="chn-qs-tools">
          <button type="button" className="chn-linkbtn" onClick={() => setWide((v) => !v)} aria-pressed={wide}>
            {wide ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />} {wide ? "Collapse" : "Expand"}
          </button>
          {piece?.studioHref && (
            <a className="chn-linkbtn" href={piece.studioHref}>
              <ExternalLink size={14} aria-hidden /> Open in Studio
            </a>
          )}
        </div>
        {wide ? (
          <div className="chn-qs-wide">
            {form}
            <div className="chn-qs-previews">
              <PreviewCard outlet="instagram" account={ig?.accounts[0] ?? "Instagram"} text={linkInBio(caption).text} piece={piece} quote={quote} />
              {(alsoFb || spec.outlet === "facebook") && <PreviewCard outlet="facebook" account={fb?.accounts[0] ?? "Facebook"} text={caption} piece={piece} quote={null} />}
            </div>
          </div>
        ) : (
          form
        )}
      </div>
    </SurfaceFrame>
  );
}

function defaultCaption(piece: Piece | undefined, outlet: Outlet): string {
  if (!piece) return "";
  const base = [piece.title, piece.excerpt].filter(Boolean).join(". ").slice(0, 400);
  const link = piece.href ? ` ${piece.href}` : "";
  return outlet === "instagram" ? `${base}${piece.href ? " Link in bio." : ""}` : `${base}${link}`;
}

export function PreviewCard({ outlet, account, text, piece, quote }: { outlet: "instagram" | "facebook" | "site"; account: string; text: string; piece: Piece | undefined; quote: string | null }) {
  return (
    <figure className="chn-preview" data-outlet={outlet}>
      <figcaption>
        <OutletIcon outlet={outlet} size={14} /> <strong>{account}</strong>
      </figcaption>
      {quote !== null && outlet === "instagram" ? (
        <div className="chn-quote-card is-big">
          <p>{quote}</p>
          <small>{piece?.title}</small>
        </div>
      ) : piece?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={piece.imageUrl} alt="" />
      ) : (
        <div className="chn-preview-blank" aria-hidden />
      )}
      <p>{text}</p>
      {outlet === "facebook" && piece?.href && (
        <div className="chn-linkcard">
          <small>{(() => {
            try {
              return new URL(piece.href).host.toUpperCase();
            } catch {
              return "";
            }
          })()}</small>
          <strong>{piece.title}</strong>
        </div>
      )}
    </figure>
  );
}
