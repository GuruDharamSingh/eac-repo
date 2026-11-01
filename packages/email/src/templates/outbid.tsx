import * as React from 'react';
import { Html, Head, Body, Container, Section, Heading, Text, Preview, Link } from '@react-email/components';
import { renderEmail } from '../render-email';

export interface OutbidEmailProps {
  name?: string | null;
  lotId: string;
  title: string;
  currentMinor: number;
  currency: string;
  lotUrl: string;
}

function fmt(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(minor / 100);
}

function OutbidEmail({ name, title, currentMinor, currency, lotUrl }: OutbidEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`You have been outbid on ${title}`}</Preview>
      <Body style={{ backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <Heading style={{ fontSize: '20px', color: '#1a1a1a', marginTop: 0 }}>You have been outbid</Heading>
            <Text style={{ fontSize: '15px', color: '#555' }}>
              {name ? `${name}, another` : 'Another'} bidder has passed your maximum on <strong>{title}</strong>. The bid now
              stands at <strong>{fmt(currentMinor, currency)}</strong>.
            </Text>
            <Text style={{ fontSize: '15px', color: '#555' }}>
              <Link href={lotUrl} style={{ color: '#7a4a1e' }}>Return to the lot</Link> to raise your maximum before it closes.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderOutbidEmail(props: OutbidEmailProps): Promise<string> {
  return renderEmail(<OutbidEmail {...props} />);
}
