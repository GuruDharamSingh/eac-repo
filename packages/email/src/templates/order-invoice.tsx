import * as React from 'react';
import {
  Html, Head, Body, Container, Section, Heading, Text, Hr, Preview,
} from '@react-email/components';
import { render } from '@react-email/render';

export interface OrderLineItem {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
}

export interface OrderInvoiceEmailProps {
  orderNumber: string;
  customerName?: string | null;
  items: OrderLineItem[];
  totalMinor: number;
  currency: string;
  /** Full eTransfer instruction text (from buildEtransferInstructions) */
  paymentInstructions: string;
  artistName: string;
  artistPayoutEmail: string;
  paymentDueAt?: string | null;
}

function fmt(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(minor / 100);
}

function OrderInvoiceEmail({
  orderNumber,
  customerName,
  items,
  totalMinor,
  currency,
  artistName,
  artistPayoutEmail,
  paymentDueAt,
}: OrderInvoiceEmailProps) {
  const dueStr = paymentDueAt
    ? new Date(paymentDueAt).toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short' })
    : null;

  return (
    <Html lang="en">
      <Head />
      <Preview>Action required: complete your purchase — Order {orderNumber}</Preview>
      <Body style={{ backgroundColor: '#f5f5f5', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>

          {/* Header */}
          <Section style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '8px 8px 0 0',
            padding: '28px 40px',
          }}>
            <Heading style={{ color: '#fff', fontSize: '20px', margin: 0, letterSpacing: '0.04em' }}>
              Art-Auction
            </Heading>
            <Text style={{ color: '#999', fontSize: '13px', margin: '4px 0 0' }}>
              Order Confirmation
            </Text>
          </Section>

          {/* Body */}
          <Section style={{
            backgroundColor: '#fff',
            padding: '40px',
            borderRadius: '0 0 8px 8px',
            border: '1px solid #e0e0e0',
            borderTop: 'none',
          }}>
            <Text style={{ fontSize: '16px', color: '#333', marginTop: 0 }}>
              {customerName ? `Hi ${customerName},` : 'Hi,'}
            </Text>
            <Text style={{ fontSize: '15px', color: '#333' }}>
              Thank you for your purchase. To complete your order, please send an Interac eTransfer
              to <strong>{artistName}</strong> at <strong>{artistPayoutEmail}</strong>.
            </Text>

            {/* Order number */}
            <Section style={{
              background: '#f8f8f8',
              borderRadius: '6px',
              padding: '12px 20px',
              margin: '20px 0',
            }}>
              <Text style={{ margin: 0, fontSize: '13px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                Order number
              </Text>
              <Text style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 'bold' as const, color: '#1a1a1a', fontFamily: 'monospace' }}>
                {orderNumber}
              </Text>
            </Section>

            {/* Items */}
            <Text style={{ fontSize: '13px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '24px 0 8px' }}>
              Items
            </Text>
            {items.map((item, i) => (
              <Section key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: '1px solid #eee',
              }}>
                <Text style={{ margin: 0, fontSize: '14px', color: '#333', flex: 1 }}>
                  {item.description}
                  {item.quantity > 1 && <span style={{ color: '#999' }}> × {item.quantity}</span>}
                </Text>
                <Text style={{ margin: 0, fontSize: '14px', color: '#333', fontWeight: 'bold' as const }}>
                  {fmt(item.unitPriceMinor * item.quantity, item.currency)}
                </Text>
              </Section>
            ))}

            {/* Total */}
            <Section style={{ padding: '16px 0 0', textAlign: 'right' as const }}>
              <Text style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' as const, color: '#1a1a1a' }}>
                Total: {fmt(totalMinor, currency)}
              </Text>
            </Section>

            <Hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '32px 0' }} />

            {/* Payment instructions box */}
            <Text style={{ fontSize: '13px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 12px' }}>
              Payment Instructions
            </Text>
            <Section style={{
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: '6px',
              padding: '20px',
            }}>
              <Text style={{ margin: 0, fontSize: '14px', color: '#333', whiteSpace: 'pre-line' as const, lineHeight: '1.7' }}>
                Send <strong>{fmt(totalMinor, currency)}</strong> via Interac eTransfer to:
              </Text>
              <Text style={{ margin: '8px 0', fontSize: '15px', color: '#1a1a1a' }}>
                <strong>{artistName}</strong> · {artistPayoutEmail}
              </Text>
              <Text style={{ margin: '8px 0 0', fontSize: '13px', color: '#666' }}>
                Include <strong>{orderNumber}</strong> in the message field.
              </Text>
              {dueStr && (
                <Text style={{ margin: '8px 0 0', fontSize: '13px', color: '#d46b08' }}>
                  Payment due by: {dueStr}
                </Text>
              )}
            </Section>

            <Hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '32px 0' }} />

            <Text style={{ fontSize: '12px', color: '#bbb', margin: 0 }}>
              Art-Auction · Elkdonis Arts Collective · Questions? Reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderOrderInvoiceEmail(props: OrderInvoiceEmailProps): Promise<string> {
  return render(React.createElement(OrderInvoiceEmail, props));
}
