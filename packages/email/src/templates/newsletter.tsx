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
  Button,
  Preview,
  Img,
} from '@react-email/components';
import { render } from '@react-email/render';

export interface NewsletterLinkItem {
  label: string;
  url: string;
}

export interface NewsletterMediaItem {
  url: string;
  alt?: string;
  caption?: string;
}

export interface NewsletterEmailProps {
  title?: string;
  previewText?: string;
  orgName?: string;
  bodyText?: string;
  links?: NewsletterLinkItem[];
  media?: NewsletterMediaItem[];
}

const defaultBodyText = `A short letter from the collective: upcoming gatherings, studio notes, publication fragments, and invitations to take part.

Use this space for newsletter copy that is not tied to account creation.`;

function paragraphsFromText(value?: string) {
  return (value?.trim() || defaultBodyText)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function NewsletterEmail({
  title = 'A Letter From The Collective',
  previewText = 'Updates, invitations, and notes from Elkdonis Arts Collective.',
  orgName = 'Elkdonis Arts Collective',
  bodyText,
  links = [],
  media = [],
}: NewsletterEmailProps) {
  const bodyParagraphs = paragraphsFromText(bodyText);

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#f4f1ea', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '640px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #d9ccad',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <Section
              style={{
                backgroundColor: '#022278',
                padding: '34px 36px',
              }}
            >
              <Text
                style={{
                  color: '#b79a55',
                  fontSize: '11px',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.16em',
                  margin: '0 0 10px',
                }}
              >
                {orgName}
              </Text>
              <Heading
                style={{
                  color: '#ffffff',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '28px',
                  fontWeight: 700,
                  lineHeight: '1.25',
                  margin: 0,
                }}
              >
                {title}
              </Heading>
            </Section>

            <Section style={{ padding: '34px 36px' }}>
              {bodyParagraphs.map((paragraph, index) => (
                <Text key={index} style={{ color: '#26323a', fontSize: '16px', lineHeight: '1.7', margin: '0 0 18px' }}>
                  {paragraph}
                </Text>
              ))}

              {media.map((item, index) => (
                <Section key={`${item.url}-${index}`} style={{ margin: '28px 0' }}>
                  <Img
                    src={item.url}
                    alt={item.alt ?? ''}
                    style={{ width: '100%', borderRadius: '6px', display: 'block', border: '1px solid #d9ccad' }}
                  />
                  {item.caption && (
                    <Text style={{ color: '#66707a', fontSize: '12px', lineHeight: '1.6', margin: '10px 0 0' }}>
                      {item.caption}
                    </Text>
                  )}
                </Section>
              ))}

              {links.length > 0 && (
                <Section style={{ margin: '30px 0 8px' }}>
                  {links.map((link) => (
                    <Button
                      key={`${link.label}-${link.url}`}
                      href={link.url}
                      style={{
                        backgroundColor: '#b79a55',
                        borderRadius: '4px',
                        color: '#101820',
                        display: 'inline-block',
                        fontFamily: 'Arial, Helvetica, sans-serif',
                        fontSize: '13px',
                        fontWeight: 700,
                        margin: '0 8px 10px 0',
                        padding: '13px 18px',
                        textDecoration: 'none',
                      }}
                    >
                      {link.label}
                    </Button>
                  ))}
                </Section>
              )}

              <Hr style={{ border: 'none', borderTop: '1px solid #e5dcc6', margin: '30px 0' }} />

              <Text style={{ color: '#66707a', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
                You are receiving this because you signed up for updates from {orgName}.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderNewsletterEmail(props: NewsletterEmailProps): Promise<string> {
  return render(React.createElement(NewsletterEmail, props));
}