import * as React from 'react';
import {
  Html, Head, Body, Container, Section, Heading, Text, Hr, Preview,
} from '@react-email/components';
import { renderEmail } from '../render-email';

/**
 * A statement of proceeds for a buyer whose purchase directs money to a
 * beneficiary (a charity, or an organisation on the network). Says what is
 * held for whom and that it is paid over by the collective. Not a tax
 * receipt: the collective is a not-for-profit, not a registered charity
 * (ORG_STORE_BRIEF §8, R2).
 */
export interface ProceedsStatementEmailProps {
  orderNumber: string;
  customerName?: string | null;
  items: Array<{
    description: string;
    amountMinor: number;
    currency: string;
    beneficiaryName: string;
    beneficiaryWebsite?: string | null;
    /** The beneficiary was suggested by a buyer and awaits approval. */
    pending?: boolean;
  }>;
  /** Set when this is the follow-up: the money has been paid over. */
  paidOn?: string | null;
}

function fmt(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(minor / 100);
}

function ProceedsStatementEmail({ orderNumber, customerName, items, paidOn }: ProceedsStatementEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{paidOn ? `Proceeds paid over — Order ${orderNumber}` : `Statement of proceeds — Order ${orderNumber}`}</Preview>
      <Body style={{ fontFamily: 'Georgia, serif', backgroundColor: '#f6f2ea', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#fffdf8', padding: '32px', maxWidth: 560 }}>
          <Heading as="h1" style={{ fontSize: 22, margin: '0 0 12px' }}>
            {paidOn ? 'Proceeds paid over' : 'Statement of proceeds'}
          </Heading>
          <Text style={{ margin: '0 0 16px', color: '#3b352c' }}>
            {customerName ? `Dear ${customerName},` : 'Hello,'} thank you for your purchase (order {orderNumber}).
            {paidOn
              ? ' The amounts below have now been paid to their beneficiaries.'
              : ' The amounts below are recorded for their beneficiaries and will be paid over by the Elkdonis Arts Collective.'}
          </Text>
          <Hr />
          {items.map((it, i) => (
            <Section key={i} style={{ padding: '8px 0' }}>
              <Text style={{ margin: 0, fontWeight: 600 }}>{it.description}</Text>
              <Text style={{ margin: '2px 0 0', color: '#3b352c' }}>
                {fmt(it.amountMinor, it.currency)} to {it.beneficiaryName}
                {it.beneficiaryWebsite ? ` (${it.beneficiaryWebsite})` : ''}
                {it.pending ? ' — held until the organisation confirms this beneficiary' : ''}
              </Text>
            </Section>
          ))}
          <Hr />
          <Text style={{ fontSize: 13, color: '#6b6457', margin: '12px 0 0' }}>
            {paidOn ? `Paid on ${paidOn}. ` : ''}
            This statement records where the proceeds of your purchase go. It is not an official donation
            receipt: the Elkdonis Arts Collective is a not-for-profit, not a registered charity, and a purchase
            is not a gift for tax purposes.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderProceedsStatementEmail(props: ProceedsStatementEmailProps): Promise<string> {
  return renderEmail(<ProceedsStatementEmail {...props} />);
}
