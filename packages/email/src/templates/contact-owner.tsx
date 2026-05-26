import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Hr,
  Preview,
} from '@react-email/components';
import { render } from '@react-email/render';

export interface ContactOwnerEmailProps {
  senderName: string;
  senderEmail: string;
  message?: string;
  orgName?: string;
  source?: string;
}

function ContactOwnerEmail({
  senderName,
  senderEmail,
  message,
  orgName = 'Elkdonis Arts Collective',
  source,
}: ContactOwnerEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Contact form message from {senderName}
      </Preview>
      <Body style={{ backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              backgroundColor: '#fff',
              padding: '40px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
            }}
          >
            <Heading style={{ fontSize: '20px', color: '#36454f', marginTop: 0 }}>
              New contact message — {orgName}
            </Heading>

            <Section
              style={{
                background: '#f8f8f8',
                borderRadius: '6px',
                padding: '20px',
                margin: '16px 0',
              }}
            >
              <Text
                style={{
                  margin: '0 0 8px',
                  fontSize: '11px',
                  color: '#999',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.06em',
                }}
              >
                From
              </Text>
              <Text style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold' as const, color: '#36454f' }}>
                {senderName}
              </Text>
              <Text style={{ margin: 0, fontSize: '14px', color: '#555' }}>
                {senderEmail}
              </Text>
            </Section>

            {message && (
              <Section style={{ margin: '16px 0' }}>
                <Text
                  style={{
                    margin: '0 0 8px',
                    fontSize: '11px',
                    color: '#999',
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
                    color: '#36454f',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap' as const,
                  }}
                >
                  {message}
                </Text>
              </Section>
            )}

            <Hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '24px 0' }} />

            <Text style={{ margin: 0, fontSize: '13px', color: '#999' }}>
              Reply to this email to respond directly to {senderName}.
              {source ? ` Source: ${source}.` : ''}
            </Text>
          </Section>

          <Text
            style={{
              fontSize: '11px',
              color: '#bbb',
              textAlign: 'center' as const,
              marginTop: '16px',
            }}
          >
            {orgName} · Elkdonis Arts Collective
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderContactOwnerEmail(props: ContactOwnerEmailProps): Promise<string> {
  return render(React.createElement(ContactOwnerEmail, props));
}
