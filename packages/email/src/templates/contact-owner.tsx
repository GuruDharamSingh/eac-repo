import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { renderEmail } from '../render-email';
import { EmailShell } from '../components/EmailShell';
import type { EmailChrome } from '../components/EmailShell';

export interface ContactOwnerEmailProps {
  senderName: string;
  senderEmail: string;
  message?: string;
  orgName?: string;
  source?: string;
  /** Which body face this organisation's mail is set in, by id. */
  bodyFont?: string;
  /**
   * The organisation's own masthead image and frame — see `EmailChrome`.
   *
   * ONE bag rather than four more props, and passed straight through to the
   * shell without this template reading any of it. Every other brand value
   * here (`orgName`, `orgAccent`, `bodyFont`) is threaded individually
   * because the BODY uses it too; nothing in a body has an opinion about the
   * picture at the top of the card, so spreading it is both shorter and the
   * honest description of what happens to it.
   */
  chrome?: EmailChrome;
}

function ContactOwnerEmail({
  senderName,
  senderEmail,
  message,
  orgName = 'Elkdonis Arts Collective',
  source,
  bodyFont,
  chrome,
}: ContactOwnerEmailProps) {
  return (
    <EmailShell
      previewText={`Contact form message from ${senderName}`}
      kicker={`New contact message — ${orgName}`}
      bodyFont={bodyFont}
      {...chrome}
      footerText={
        <Text style={{ margin: 0, fontSize: '12px', color: '#999' }}>
          Reply to this email to respond directly to {senderName}.
          {source ? ` Source: ${source}.` : ''}
        </Text>
      }
    >
      <Section
        style={{
          background: '#f4f7ff',
          borderRadius: '6px',
          padding: '20px',
          margin: '0 0 16px',
        }}
      >
        <Text
          style={{
            margin: '0 0 8px',
            fontSize: '11px',
            color: '#8f763c',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
          }}
        >
          From
        </Text>
        <Text style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold' as const, color: '#01124E' }}>
          {senderName}
        </Text>
        <Text style={{ margin: 0, fontSize: '14px', color: '#374238' }}>
          {senderEmail}
        </Text>
      </Section>

      {message && (
        <Section style={{ margin: '16px 0' }}>
          <Text
            style={{
              margin: '0 0 8px',
              fontSize: '11px',
              color: '#8f763c',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.06em',
            }}
          >
            Message
          </Text>
          <Text
            style={{
              margin: 0,
              fontSize: '15px',
              color: '#374238',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap' as const,
            }}
          >
            {message}
          </Text>
        </Section>
      )}
    </EmailShell>
  );
}

export async function renderContactOwnerEmail(props: ContactOwnerEmailProps): Promise<string> {
  return renderEmail(React.createElement(ContactOwnerEmail, props));
}
