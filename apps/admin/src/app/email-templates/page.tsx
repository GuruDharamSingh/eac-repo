import {
  Badge,
  Box,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Mail, Send, FileCode2 } from 'lucide-react';
import {
  renderContactOwnerEmail,
  renderOrderInvoiceEmail,
  renderOrderNotificationEmail,
  renderRsvpGuestEmail,
  renderRsvpOwnerEmail,
  renderWelcomeEmail,
} from '@elkdonis/email';

interface TemplatePreview {
  key: string;
  title: string;
  trigger: string;
  recipient: string;
  subject: string;
  source: string;
  sendFunction: string;
  sendGridMode: string;
  html: string;
}

const sampleDate = new Date('2026-06-21T14:00:00-04:00').toISOString();
const sampleDueDate = new Date('2026-06-24T17:00:00-04:00').toISOString();

export default async function EmailTemplatesPage() {
  const sharedOrderItems = [
    {
      description: 'Framed study: Blue Garden',
      quantity: 1,
      unitPriceMinor: 45000,
      artistShareMinor: 36000,
      galleryShareMinor: 9000,
      currency: 'CAD',
    },
  ];

  const templates: TemplatePreview[] = [
    {
      key: 'rsvp-guest',
      title: 'RSVP Confirmation',
      trigger: 'Meeting RSVP with confirmation email enabled',
      recipient: 'Attendee',
      subject: 'RSVP Confirmed - Our Meeting',
      source: 'packages/email/src/templates/rsvp-guest.tsx',
      sendFunction: 'sendRsvpConfirmation',
      sendGridMode: 'SendGrid mail send with rendered React Email HTML',
      html: await renderRsvpGuestEmail({
        guestName: 'Justin Gillis',
        meetingTitle: 'Our Meeting',
        scheduledAt: sampleDate,
        location: 'Inner Gathering Room',
        meetingUrl: 'https://gathering.elkdonis-arts.org/meetings/our-meeting',
        orgName: 'Inner Gathering',
        primaryColor: '#022278',
      }),
    },
    {
      key: 'rsvp-owner',
      title: 'New RSVP Notification',
      trigger: 'Someone RSVPs to a meeting',
      recipient: 'Meeting guide or organizer',
      subject: 'New RSVP: Justin Gillis - Our Meeting',
      source: 'packages/email/src/templates/rsvp-owner.tsx',
      sendFunction: 'sendRsvpNotification',
      sendGridMode: 'SendGrid mail send with rendered React Email HTML',
      html: await renderRsvpOwnerEmail({
        guestName: 'Justin Gillis',
        guestEmail: 'justin.gillisb@gmail.com',
        meetingTitle: 'Our Meeting',
        scheduledAt: sampleDate,
        orgName: 'Inner Gathering',
        rsvpCount: 1,
      }),
    },
    {
      key: 'welcome',
      title: 'Welcome Email',
      trigger: 'New account or member profile creation',
      recipient: 'New member',
      subject: 'Welcome to Elkdonis Arts Collective',
      source: 'packages/email/src/templates/welcome.tsx',
      sendFunction: 'sendWelcomeEmail',
      sendGridMode: 'SendGrid mail send with rendered React Email HTML',
      html: await renderWelcomeEmail({
        displayName: 'New Member',
        portalUrl: 'https://gathering.elkdonis-arts.org',
      }),
    },
    {
      key: 'contact-owner',
      title: 'Contact Notification',
      trigger: 'Contact form submission',
      recipient: 'Site owner or admin inbox',
      subject: 'Contact form: New Member - Elkdonis Arts Collective',
      source: 'packages/email/src/templates/contact-owner.tsx',
      sendFunction: 'sendContactNotification',
      sendGridMode: 'SendGrid mail send with rendered React Email HTML',
      html: await renderContactOwnerEmail({
        senderName: 'New Member',
        senderEmail: 'member@example.com',
        orgName: 'Elkdonis Arts Collective',
        source: 'Soft launch signup',
        message: 'I would like to hear more about upcoming offerings and the monthly newsletter.',
      }),
    },
    {
      key: 'order-invoice',
      title: 'Order Invoice',
      trigger: 'Art order checkout creates payment instructions',
      recipient: 'Customer',
      subject: 'Action required: complete your purchase - Order AA-1024',
      source: 'packages/email/src/templates/order-invoice.tsx',
      sendFunction: 'sendOrderInvoice',
      sendGridMode: 'SendGrid mail send with rendered React Email HTML',
      html: await renderOrderInvoiceEmail({
        orderNumber: 'AA-1024',
        customerName: 'Collector Name',
        items: sharedOrderItems,
        totalMinor: 45000,
        currency: 'CAD',
        paymentInstructions: 'Send payment by Interac eTransfer and include the order number in the message field.',
        artistName: 'EAC Artist',
        artistPayoutEmail: 'artist@example.com',
        paymentDueAt: sampleDueDate,
      }),
    },
    {
      key: 'order-notification',
      title: 'Order Notification',
      trigger: 'Art order placed',
      recipient: 'Artist or platform operator',
      subject: 'Sale pending - Order AA-1024',
      source: 'packages/email/src/templates/order-notification.tsx',
      sendFunction: 'sendOrderNotification',
      sendGridMode: 'SendGrid mail send with rendered React Email HTML',
      html: await renderOrderNotificationEmail({
        role: 'artist',
        orderNumber: 'AA-1024',
        customerName: 'Collector Name',
        customerEmail: 'collector@example.com',
        artistName: 'EAC Artist',
        items: sharedOrderItems,
        totalMinor: 45000,
        currency: 'CAD',
        paymentDueAt: sampleDueDate,
      }),
    },
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <Mail size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Title order={2}>Email Templates</Title>
              <Text size="sm" c="dimmed">
                Review the custom React Email templates currently sent through SendGrid.
              </Text>
            </Stack>
          </Group>
          <Badge size="lg" variant="light" color="blue" leftSection={<Send size={14} />}>
            {templates.length} templates
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
          {templates.map((template) => (
            <Paper key={template.key} withBorder radius="sm" p="md">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Title order={3} size="h4">{template.title}</Title>
                      <Badge size="xs" variant="light" color="gray">{template.key}</Badge>
                    </Group>
                    <Text size="sm" c="dimmed">{template.trigger}</Text>
                  </Stack>
                  <ThemeIcon variant="light" color="gray" radius="sm">
                    <FileCode2 size={16} />
                  </ThemeIcon>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  <Meta label="Recipient" value={template.recipient} />
                  <Meta label="Send Function" value={template.sendFunction} />
                  <Meta label="Subject" value={template.subject} />
                  <Meta label="Source" value={template.source} />
                </SimpleGrid>

                <Text size="xs" c="dimmed">
                  {template.sendGridMode}. SendGrid dynamic template IDs are not used by this code path yet.
                </Text>

                <Box
                  style={{
                    border: '1px solid var(--mantine-color-gray-3)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    background: '#f8f9fa',
                  }}
                >
                  <iframe
                    title={`${template.title} preview`}
                    srcDoc={template.html}
                    style={{
                      width: '100%',
                      height: 620,
                      border: 0,
                      display: 'block',
                      background: '#fff',
                    }}
                  />
                </Box>
              </Stack>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: '0.06em' }}>
        {label}
      </Text>
      <Text size="sm" style={{ overflowWrap: 'anywhere' }}>{value}</Text>
    </Stack>
  );
}
