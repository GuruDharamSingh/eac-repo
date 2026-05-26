import * as React from 'react';
import {
  Html, Head, Body, Container, Section, Heading, Text, Hr, Preview,
} from '@react-email/components';
import { render } from '@react-email/render';

export interface OrderNotificationEmailProps {
  role: 'artist' | 'platform';
  orderNumber: string;
  customerName?: string | null;
  customerEmail: string;
  artistName: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    artistShareMinor?: number | null;
    galleryShareMinor?: number | null;
    currency: string;
  }>;
  totalMinor: number;
  currency: string;
  paymentDueAt?: string | null;
}

function fmt(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(minor / 100);
}

function OrderNotificationEmail({
  role,
  orderNumber,
  customerName,
  customerEmail,
  artistName,
  items,
  totalMinor,
  currency,
  paymentDueAt,
}: OrderNotificationEmailProps) {
  const isArtist = role === 'artist';
  const dueStr = paymentDueAt
    ? new Date(paymentDueAt).toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short' })
    : null;

  const artistTotal = items.reduce((s, l) => s + (l.artistShareMinor ?? 0) * l.quantity, 0);
  const platformTotal = items.reduce((s, l) => s + (l.galleryShareMinor ?? 0) * l.quantity, 0);

  const headline = isArtist
    ? `Sale pending — eTransfer of ${fmt(totalMinor, currency)} incoming`
    : `New sale — Order ${orderNumber}`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={{ backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
          <Section style={{
            backgroundColor: '#fff',
            padding: '40px',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
          }}>
            <Heading style={{ fontSize: '20px', color: '#1a1a1a', marginTop: 0 }}>
              {headline}
            </Heading>

            {isArtist ? (
              <Text style={{ fontSize: '15px', color: '#555' }}>
                {customerName || customerEmail} has placed an order and will be sending you an
                Interac eTransfer. Watch your inbox — the reference is{' '}
                <strong style={{ fontFamily: 'monospace' }}>{orderNumber}</strong>.
              </Text>
            ) : (
              <Text style={{ fontSize: '15px', color: '#555' }}>
                A new sale has been placed on Art-Auction.
              </Text>
            )}

            {/* Summary row */}
            <Section style={{
              background: '#f8f8f8',
              borderRadius: '6px',
              padding: '16px 20px',
              margin: '20px 0',
            }}>
              <Text style={{ margin: '0 0 4px', fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                Order
              </Text>
              <Text style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 'bold' as const, color: '#1a1a1a', fontFamily: 'monospace' }}>
                {orderNumber}
              </Text>
              <Text style={{ margin: '0 0 4px', fontSize: '13px', color: '#555' }}>
                <strong>Customer:</strong> {customerName || '—'} · {customerEmail}
              </Text>
              <Text style={{ margin: '0 0 4px', fontSize: '13px', color: '#555' }}>
                <strong>Artist:</strong> {artistName}
              </Text>
              {dueStr && (
                <Text style={{ margin: '0', fontSize: '13px', color: '#d46b08' }}>
                  <strong>eTransfer due:</strong> {dueStr}
                </Text>
              )}
            </Section>

            {/* Items */}
            <Text style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '20px 0 8px' }}>
              Items
            </Text>
            {items.map((item, i) => (
              <Section key={i} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                <Text style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                  {item.description}
                  {item.quantity > 1 && ` × ${item.quantity}`}
                </Text>
                <Text style={{ margin: '2px 0 0', fontSize: '13px', color: '#888' }}>
                  {fmt(item.unitPriceMinor * item.quantity, item.currency)}
                  {isArtist && item.artistShareMinor != null && (
                    <> · Your share: {fmt(item.artistShareMinor * item.quantity, item.currency)}</>
                  )}
                  {!isArtist && item.galleryShareMinor != null && (
                    <> · Platform share: {fmt(item.galleryShareMinor * item.quantity, item.currency)}</>
                  )}
                </Text>
              </Section>
            ))}

            {/* Totals */}
            <Section style={{ padding: '16px 0 0' }}>
              <Text style={{ margin: '0 0 4px', fontSize: '14px', color: '#555', textAlign: 'right' as const }}>
                Sale total: <strong>{fmt(totalMinor, currency)}</strong>
              </Text>
              {isArtist && artistTotal > 0 && (
                <Text style={{ margin: 0, fontSize: '14px', color: '#228b22', textAlign: 'right' as const }}>
                  Your earnings: <strong>{fmt(artistTotal, currency)}</strong>
                </Text>
              )}
              {!isArtist && platformTotal > 0 && (
                <Text style={{ margin: 0, fontSize: '14px', color: '#555', textAlign: 'right' as const }}>
                  Platform commission: <strong>{fmt(platformTotal, currency)}</strong>
                </Text>
              )}
            </Section>

            <Hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '28px 0' }} />

            <Text style={{ fontSize: '12px', color: '#bbb', margin: 0 }}>
              Art-Auction · Elkdonis Arts Collective
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderOrderNotificationEmail(props: OrderNotificationEmailProps): Promise<string> {
  return render(React.createElement(OrderNotificationEmail, props));
}
