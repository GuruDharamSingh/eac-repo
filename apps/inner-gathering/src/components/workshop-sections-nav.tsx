"use client";

import { useState, type ComponentType } from "react";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  Info,
  Link as LinkIcon,
  Lock,
  MessageCircle,
  Play,
  Video,
} from "lucide-react";
import { sanitizeRichText } from "@elkdonis/utils";
import { WorkshopMaterials } from "@elkdonis/ui";
import { fmt, sessionStatus, STATUS_CONFIG } from "@/lib/workshop-session-status";
import type { Resource, Session } from "./workshop-page";

// ============================================================================
// Workshop detail page navigator — sections list ("Overview" + one entry per
// session) on one side, the selected section's content on the other.
// Deliberately built without Mantine: plain elements + globals.css (.wsn__*
// classes) so the interaction (active-section switching, sticky nav,
// mobile horizontal scroll) isn't constrained by Mantine's Tabs API.
// ============================================================================

const RESOURCE_ICON: Record<string, ComponentType<{ size?: number }>> = {
  video: Video,
  pdf: FileText,
  doc: BookOpen,
  link: LinkIcon,
  audio: Play,
};

function ResourceRow({ res, isEnrolled }: { res: Resource; isEnrolled: boolean }) {
  const locked = !res.isPublic && !isEnrolled;
  const Icon = RESOURCE_ICON[res.type] ?? FileText;

  const inner = (
    <div className={`wsn__resource${locked ? " wsn__resource--locked" : ""}`}>
      <span className="wsn__resource-icon">{locked ? <Lock size={12} /> : <Icon size={12} />}</span>
      <span className="wsn__resource-title">{res.title}</span>
      {locked ? (
        <span className="wsn__resource-badge">Members only</span>
      ) : (
        <ExternalLink size={12} />
      )}
    </div>
  );

  if (locked) return inner;
  return (
    <a className="wsn__resource-link" href={res.url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  );
}

function SessionPane({
  session,
  isEnrolled,
  now,
}: {
  session: Session;
  isEnrolled: boolean;
  now: number | null;
}) {
  const status = now === null ? "upcoming" : sessionStatus(session.scheduledAt, session.durationMinutes, now);
  const sc = STATUS_CONFIG[status];
  const resources = session.resources ?? [];
  const hasVideoConf = !!(session.videoConferenceUrl || session.nextcloudTalkToken);

  return (
    <div className="wsn__pane" style={{ borderLeftColor: sc.color, background: session.backgroundColor || sc.bg }}>
      <div className="wsn__pane-head">
        <div>
          <h3 className="wsn__pane-title">{session.title}</h3>
          <div className="wsn__pane-meta">
            <span>
              <Calendar size={13} />
              {fmt(session.scheduledAt, { month: "short", day: "numeric", year: "numeric" })}
            </span>
            {session.durationMinutes && (
              <span>
                <Clock size={13} />
                {session.durationMinutes} min
              </span>
            )}
          </div>
        </div>
        {status === "live" && <span className="wsn__badge wsn__badge--live">● Live</span>}
      </div>

      {session.mediaUrl && <img className="wsn__pane-image" src={session.mediaUrl} alt={session.title} />}

      {session.videoUrl &&
        (isEnrolled ? (
          <video className="wsn__pane-video" src={session.videoUrl} controls />
        ) : (
          <p className="wsn__hint">Enroll to watch this session's video</p>
        ))}

      {session.description && <p className="wsn__pane-desc">{session.description}</p>}

      {hasVideoConf && (
        <div className="wsn__pane-actions">
          {session.nextcloudTalkToken ? (
            <a
              className={`wsn__btn ${isEnrolled ? "wsn__btn--filled-red" : "wsn__btn--disabled"}`}
              href={isEnrolled ? `/api/talk/join?token=${session.nextcloudTalkToken}` : undefined}
              aria-disabled={!isEnrolled}
            >
              <Video size={16} />
              {isEnrolled ? "Join Talk Room" : "Enroll to Join"}
            </a>
          ) : session.videoConferenceUrl ? (
            <a
              className={`wsn__btn ${isEnrolled ? "wsn__btn--filled" : "wsn__btn--disabled"}`}
              href={isEnrolled ? session.videoConferenceUrl : undefined}
              target={isEnrolled ? "_blank" : undefined}
              rel="noopener noreferrer"
              aria-disabled={!isEnrolled}
            >
              <Video size={16} />
              {isEnrolled ? "Join Video Session" : "Enroll to Join"}
            </a>
          ) : null}
          {!isEnrolled && <span className="wsn__hint">Enroll to access live sessions</span>}
        </div>
      )}

      {resources.length > 0 && (
        <div className="wsn__resources">
          <div className="wsn__resources-label">Materials</div>
          {resources.map((res) => (
            <ResourceRow key={res.id} res={res} isEnrolled={isEnrolled} />
          ))}
        </div>
      )}

      {!session.isOnline && session.location && <p className="wsn__hint">📍 {session.location}</p>}
    </div>
  );
}

function OverviewPane({
  workshopId,
  pitch,
  description,
  nextcloudTalkToken,
  isEnrolled,
  isOwner,
  sessionCount,
  pastCount,
  progressPct,
}: {
  workshopId: string;
  pitch?: string;
  description?: string;
  nextcloudTalkToken?: string;
  isEnrolled: boolean;
  isOwner: boolean;
  sessionCount: number;
  pastCount: number;
  progressPct: number;
}) {
  const [descOpen, setDescOpen] = useState(false);
  const hasDescription = Boolean(pitch || description);

  return (
    <div className="wsn__overview">
      {isEnrolled && sessionCount > 0 && (
        <div className="wsn__progress">
          <div className="wsn__progress-head">
            <span className="wsn__progress-title">Your Progress</span>
            <span className="wsn__progress-count">{pastCount} / {sessionCount} sessions</span>
          </div>
          <div className="wsn__progress-track">
            <div className="wsn__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {hasDescription && (
        <div className="wsn__section">
          <button
            type="button"
            className="wsn__section-toggle"
            onClick={() => setDescOpen((o) => !o)}
            aria-expanded={descOpen}
          >
            <span className="wsn__section-toggle-label">Description</span>
            <ChevronDown size={18} className={`wsn__section-chevron${descOpen ? " wsn__section-chevron--open" : ""}`} />
          </button>
          {descOpen && (
            <div
              className="wsn__section-body"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(pitch ?? description ?? "") }}
            />
          )}
        </div>
      )}

      {nextcloudTalkToken && (
        <div className={`wsn__card${isEnrolled ? " wsn__card--enrolled" : ""}`}>
          <div className="wsn__card-icon">
            <MessageCircle size={18} />
          </div>
          <div className="wsn__card-body">
            <div className="wsn__card-title">Workshop Discussion Room</div>
            <div className="wsn__card-sub">Live group chat on Nextcloud Talk</div>
          </div>
          {isEnrolled ? (
            <a
              className="wsn__btn wsn__btn--filled"
              href={`/api/talk/join?token=${nextcloudTalkToken}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={14} />
              Open Room
            </a>
          ) : (
            <span className="wsn__btn wsn__btn--disabled">Members Only</span>
          )}
        </div>
      )}

      {(isEnrolled || isOwner) && <WorkshopMaterials workshopId={workshopId} />}
    </div>
  );
}

export interface WorkshopSectionsNavProps {
  workshopId: string;
  pitch?: string;
  description?: string;
  nextcloudTalkToken?: string;
  sessions: Session[];
  isEnrolled: boolean;
  isOwner: boolean;
  now: number | null;
  pastCount: number;
  progressPct: number;
}

export function WorkshopSectionsNav({
  workshopId,
  pitch,
  description,
  nextcloudTalkToken,
  sessions,
  isEnrolled,
  isOwner,
  now,
  pastCount,
  progressPct,
}: WorkshopSectionsNavProps) {
  const [active, setActive] = useState<string>("overview");
  const activeSession = sessions.find((s) => s.id === active);

  return (
    <div className="wsn">
      <div className="wsn__nav-wrap">
        <nav className="wsn__nav" aria-label="Workshop sections">
          <button
            type="button"
            className={`wsn__nav-item${active === "overview" ? " wsn__nav-item--active" : ""}`}
            onClick={() => setActive("overview")}
          >
            <span className="wsn__nav-bubble wsn__nav-bubble--overview">
              <Info size={13} />
            </span>
            <span className="wsn__nav-label">Overview</span>
          </button>
          {sessions.map((session, i) => {
            const status = now === null ? "upcoming" : sessionStatus(session.scheduledAt, session.durationMinutes, now);
            const sc = STATUS_CONFIG[status];
            const isActive = active === session.id;
            return (
              <button
                key={session.id}
                type="button"
                className={`wsn__nav-item${isActive ? " wsn__nav-item--active" : ""}`}
                onClick={() => setActive(session.id)}
              >
                <span className="wsn__nav-bubble" style={{ background: sc.color }}>
                  {i + 1}
                </span>
                <span className="wsn__nav-label">{session.title || `Session ${i + 1}`}</span>
                {status === "live" && <span className="wsn__live-dot" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="wsn__content">
        {activeSession ? (
          <SessionPane session={activeSession} isEnrolled={isEnrolled} now={now} />
        ) : (
          <OverviewPane
            workshopId={workshopId}
            pitch={pitch}
            description={description}
            nextcloudTalkToken={nextcloudTalkToken}
            isEnrolled={isEnrolled}
            isOwner={isOwner}
            sessionCount={sessions.length}
            pastCount={pastCount}
            progressPct={progressPct}
          />
        )}
      </div>
    </div>
  );
}
