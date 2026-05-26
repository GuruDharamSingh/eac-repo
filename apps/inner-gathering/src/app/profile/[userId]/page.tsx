import { notFound } from 'next/navigation';
import { db } from '@elkdonis/db';
import '../profile.css';

const DISCIPLINE_LABELS: Record<string, string> = {
  'visual-art': 'Visual Art', music: 'Music', writing: 'Writing',
  'dance': 'Dance / Movement', yoga: 'Yoga / Somatic', healing: 'Healing Arts',
  ceramics: 'Ceramics / Craft', textile: 'Textile / Fibre', film: 'Film / Video',
  photography: 'Photography', theatre: 'Theatre / Performance', sound: 'Sound / Audio',
  design: 'Design', culinary: 'Culinary Arts', other: 'Other',
};

const EXP_LABELS: Record<string, string> = {
  starting_fresh: 'Starting Fresh',
  established: 'Established',
};

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function PublicProfilePage({ params }: Props) {
  const { userId } = await params;

  const [profile] = await db`
    SELECT
      user_id, display_name, city, bio, photo_url,
      disciplines, portfolio_url, experience_level,
      personal_philosophy, aesthetic_notes, aesthetic_keywords,
      audience_description, goals_seeking, goals_offering,
      mutual_aid_media, mutual_aid_authoring, needs, is_stub, created_at
    FROM artist_profiles
    WHERE user_id = ${userId}
      AND is_stub = false
    LIMIT 1
  `;

  if (!profile) notFound();

  const name = profile.display_name || 'Artist';
  const initials = name[0].toUpperCase();
  const joined = new Date(profile.created_at as string).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long',
  });

  return (
    <div className="profile-root">
      <header className="profile-header">
        <p style={{ fontFamily: "'Cinzel', serif", fontSize: '0.7rem', letterSpacing: '0.15em',
          textTransform: 'uppercase', color: '#a97408', margin: '0 0 0.5rem' }}>
          Elkdonis Arts Collective
        </p>
        <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)' }}>{name}</h1>
        {profile.city && (
          <p className="tagline" style={{ fontStyle: 'normal', color: '#7a5430' }}>
            {profile.city as string}
          </p>
        )}
        {profile.experience_level && (
          <div style={{ marginTop: '0.5rem' }}>
            <span className="profile-status listed">
              {EXP_LABELS[profile.experience_level as string] ?? profile.experience_level}
            </span>
          </div>
        )}
      </header>

      {/* Portrait */}
      <section className="baroque-frame">
        <div className="frame-head">
          <p className="frame-title">Portrait</p>
        </div>

        <div className="portrait-row" style={{ marginBottom: 0 }}>
          <div className="avatar-wrap" style={{ cursor: 'default' }}>
            <div className="avatar-circle" style={{ cursor: 'default' }}>
              {profile.photo_url
                ? <img src={profile.photo_url as string} alt={name} />
                : initials}
            </div>
          </div>
          <div className="portrait-fields" style={{ justifyContent: 'center' }}>
            {profile.bio && (
              <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.65, color: '#1e150a' }}>
                {profile.bio as string}
              </p>
            )}
            {profile.portfolio_url && (
              <a
                href={profile.portfolio_url as string}
                target="_blank"
                rel="noreferrer"
                className="network-link"
                style={{ alignSelf: 'flex-start', marginTop: '0.75rem' }}
              >
                Portfolio →
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Practice */}
      {((profile.disciplines as string[])?.length > 0) && (
        <section className="baroque-frame">
          <p className="frame-title">Practice</p>
          <div className="chip-group" style={{ marginTop: '0.75rem' }}>
            {(profile.disciplines as string[]).map((d) => (
              <span key={d} className="chip active" style={{ cursor: 'default' }}>
                {DISCIPLINE_LABELS[d] ?? d}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Philosophy */}
      {(profile.personal_philosophy || profile.aesthetic_notes) && (
        <section className="baroque-frame">
          <p className="frame-title">Their World</p>
          {profile.personal_philosophy && (
            <div className="field-group" style={{ marginBottom: profile.aesthetic_notes ? '1.25rem' : 0 }}>
              <p className="frame-note" style={{ margin: 0 }}>Philosophy</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.05rem', lineHeight: 1.65 }}>
                {profile.personal_philosophy as string}
              </p>
            </div>
          )}
          {profile.aesthetic_notes && (
            <div className="field-group" style={{ marginBottom: 0 }}>
              {profile.personal_philosophy && <hr className="frame-rule" />}
              <p className="frame-note" style={{ margin: 0 }}>Aesthetic</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.05rem', lineHeight: 1.65 }}>
                {profile.aesthetic_notes as string}
              </p>
            </div>
          )}
          {(profile.aesthetic_keywords as string[])?.length > 0 && (
            <>
              <hr className="frame-rule" />
              <div className="chip-group">
                {(profile.aesthetic_keywords as string[]).map((k) => (
                  <span key={k} className="chip active" style={{ cursor: 'default', fontSize: '0.82rem' }}>
                    {k}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Seeking & Offering */}
      {(profile.goals_seeking || profile.goals_offering) && (
        <section className="baroque-frame">
          <p className="frame-title">Seeking &amp; Offering</p>
          {profile.goals_seeking && (
            <div className="field-group" style={{ marginBottom: profile.goals_offering ? '1.25rem' : 0 }}>
              <p className="frame-note" style={{ margin: 0 }}>Looking for</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.05rem', lineHeight: 1.65 }}>
                {profile.goals_seeking as string}
              </p>
            </div>
          )}
          {profile.goals_offering && (
            <div className="field-group" style={{ marginBottom: 0 }}>
              {profile.goals_seeking && <hr className="frame-rule" />}
              <p className="frame-note" style={{ margin: 0 }}>Can offer</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.05rem', lineHeight: 1.65 }}>
                {profile.goals_offering as string}
              </p>
            </div>
          )}
          {(profile.needs as string[])?.length > 0 && (
            <>
              <hr className="frame-rule" />
              <p className="frame-note" style={{ margin: '0 0 0.5rem' }}>Current needs</p>
              <div className="chip-group">
                {(profile.needs as string[]).map((n) => (
                  <span key={n} className="chip" style={{ cursor: 'default' }}>{n}</span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Mutual aid */}
      {(profile.mutual_aid_media || profile.mutual_aid_authoring) && (
        <section className="baroque-frame">
          <p className="frame-title">Open to Mutual Aid</p>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {profile.mutual_aid_media && (
              <p style={{ margin: 0, fontSize: '1rem', color: '#52643a' }}>
                ✦ Media production support
              </p>
            )}
            {profile.mutual_aid_authoring && (
              <p style={{ margin: 0, fontSize: '1rem', color: '#52643a' }}>
                ✦ Web &amp; authoring support
              </p>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <section className="baroque-frame">
        <p className="frame-title">Collective Member</p>
        <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.92rem', fontStyle: 'italic', color: '#7a5430' }}>
          Member since {joined}. Part of the Elkdonis Arts Collective mutual aid network.
        </p>
        <div className="network-links">
          <a href="http://localhost:3007/artists" target="_blank" rel="noreferrer" className="network-link">
            Open Artist Directory →
          </a>
          <a href="/" className="network-link">
            Inner Gathering →
          </a>
        </div>
      </section>
    </div>
  );
}
