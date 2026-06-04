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
} from "@mantine/core";
import { FileCode2, Mail } from "lucide-react";
import {
  renderContactOwnerEmail,
  renderOrderInvoiceEmail,
  renderOrderNotificationEmail,
  renderNewsletterEmail,
  renderRsvpGuestEmail,
  renderRsvpOwnerEmail,
  renderWelcomeEmail,
} from "@elkdonis/email";
import { EditableTemplateEditor } from "./editable-template-editor";
import {
  EMAIL_TEMPLATE_ORG_ID,
  NEWSLETTER_TEMPLATE_KEY,
  SIGNUP_WELCOME_TEMPLATE_KEY,
  getEmailTemplateSettings,
} from "@/lib/email-template-settings";

interface EmailPreview {
  key: string;
  title: string;
  trigger: string;
  recipient: string;
  subject: string;
  source: string;
  html: string;
}

const sampleDate = new Date("2026-06-21T14:00:00-04:00").toISOString();
const sampleDueDate = new Date("2026-06-24T17:00:00-04:00").toISOString();

const defaultWelcomeBody =
  "Welcome to the collective. Your member account is ready, and the Inner Gathering is open for workshops, posts, meetings, and shared updates.";

const defaultWelcomeLinks = [
  { label: "Enter the Gathering", url: "http://localhost:3004/feed?welcome=1" },
  { label: "Visit the Collective", url: "https://elkdonis-arts.org" },
];

const defaultNewsletterBody =
  "A short letter from the collective: upcoming gatherings, studio notes, publication fragments, and invitations to take part.\n\nUse this space for newsletter copy that is not tied to account creation.";

const defaultNewsletterLinks = [
  { label: "Read the latest posts", url: "http://localhost:3004/feed" },
  { label: "Visit Elkdonis Arts", url: "https://elkdonis-arts.org" },
];

export default async function EmailTemplatesPage() {
  const signupSettings = await getEmailTemplateSettings(
    EMAIL_TEMPLATE_ORG_ID,
    SIGNUP_WELCOME_TEMPLATE_KEY
  ).catch((error) => {
    console.error("[email-templates] welcome settings load failed:", error);
    return null;
  });

  const newsletterSettings = await getEmailTemplateSettings(
    EMAIL_TEMPLATE_ORG_ID,
    NEWSLETTER_TEMPLATE_KEY
  ).catch((error) => {
    console.error("[email-templates] newsletter settings load failed:", error);
    return null;
  });

  const signupPreviewHtml = await renderWelcomeEmail({
    displayName: "New Member",
    portalUrl: "http://localhost:3004/feed?welcome=1",
    bodyText: defaultWelcomeBody,
    links: defaultWelcomeLinks,
    ...(signupSettings?.config ?? {}),
  });

  const newsletterPreviewHtml = await renderNewsletterEmail({
    title: "A Letter From The Collective",
    previewText: "Updates, invitations, and notes from Elkdonis Arts Collective.",
    bodyText: defaultNewsletterBody,
    links: defaultNewsletterLinks,
    ...(newsletterSettings?.config ?? {}),
  });

  const orderItems = [
    {
      description: "Framed study: Blue Garden",
      quantity: 1,
      unitPriceMinor: 45000,
      artistShareMinor: 36000,
      galleryShareMinor: 9000,
      currency: "CAD",
    },
  ];

  const previews: EmailPreview[] = [
    {
      key: "rsvp-guest",
      title: "RSVP Confirmation",
      trigger: "A member RSVPs to a meeting and leaves email confirmation enabled.",
      recipient: "The person who RSVP'd",
      subject: "RSVP Confirmed - Our Meeting",
      source: "packages/email/src/templates/rsvp-guest.tsx",
      html: await renderRsvpGuestEmail({
        guestName: "Justin Gillis",
        meetingTitle: "Our Meeting",
        scheduledAt: sampleDate,
        location: "Inner Gathering Room",
        meetingUrl: "https://gathering.elkdonis-arts.org/meetings/our-meeting",
        orgName: "Inner Gathering",
        primaryColor: "#022278",
      }),
    },
    {
      key: "rsvp-owner",
      title: "New RSVP Notification",
      trigger: "A member RSVPs to a meeting authored by someone with an email address.",
      recipient: "Meeting author or guide",
      subject: "New RSVP: Justin Gillis - Our Meeting",
      source: "packages/email/src/templates/rsvp-owner.tsx",
      html: await renderRsvpOwnerEmail({
        guestName: "Justin Gillis",
        guestEmail: "justin.gillisb@gmail.com",
        meetingTitle: "Our Meeting",
        scheduledAt: sampleDate,
        rsvpCreatedAt: new Date("2026-06-20T18:33:00-04:00").toISOString(),
        threadUrl: "http://localhost:3004/meetings/our-meeting",
        orgName: "Inner Gathering",
        rsvpCount: 1,
      }),
    },
    {
      key: "welcome",
      title: "New Member Welcome",
      trigger: "A new account/member profile is created.",
      recipient: "New member",
      subject: "Welcome to Elkdonis Arts Collective",
      source: "packages/email/src/templates/welcome.tsx",
      html: signupPreviewHtml,
    },
    {
      key: "newsletter",
      title: "Newsletter",
      trigger: "A newsletter or update is sent to subscribers.",
      recipient: "Newsletter subscriber list",
      subject: "A Letter From The Collective",
      source: "packages/email/src/templates/newsletter.tsx",
      html: newsletterPreviewHtml,
    },
    {
      key: "contact-owner",
      title: "Contact Notification",
      trigger: "A contact or signup form sends a message to the collective.",
      recipient: "Site owner or admin inbox",
      subject: "Contact form: New Member - Elkdonis Arts Collective",
      source: "packages/email/src/templates/contact-owner.tsx",
      html: await renderContactOwnerEmail({
        senderName: "New Member",
        senderEmail: "member@example.com",
        orgName: "Elkdonis Arts Collective",
        source: "Soft launch signup",
        message: "I would like to hear more about upcoming offerings and the monthly newsletter.",
      }),
    },
    {
      key: "order-invoice",
      title: "Order Invoice",
      trigger: "An art order is placed and payment instructions need to be sent.",
      recipient: "Customer",
      subject: "Action required: complete your purchase - Order AA-1024",
      source: "packages/email/src/templates/order-invoice.tsx",
      html: await renderOrderInvoiceEmail({
        orderNumber: "AA-1024",
        customerName: "Collector Name",
        items: orderItems,
        totalMinor: 45000,
        currency: "CAD",
        paymentInstructions: "Send payment by Interac eTransfer and include the order number in the message field.",
        artistName: "EAC Artist",
        artistPayoutEmail: "artist@example.com",
        paymentDueAt: sampleDueDate,
      }),
    },
    {
      key: "order-notification",
      title: "Order Notification",
      trigger: "An art order is placed and the artist/platform needs a sale notice.",
      recipient: "Artist or platform operator",
      subject: "Sale pending - Order AA-1024",
      source: "packages/email/src/templates/order-notification.tsx",
      html: await renderOrderNotificationEmail({
        role: "artist",
        orderNumber: "AA-1024",
        customerName: "Collector Name",
        customerEmail: "collector@example.com",
        artistName: "EAC Artist",
        items: orderItems,
        totalMinor: 45000,
        currency: "CAD",
        paymentDueAt: sampleDueDate,
      }),
    },
  ];

  return (
    <Box className="archive-shell">
      <Container size="xl" py="xl" pb={128}>
        <Stack gap="xl">
          <Group justify="space-between" align="flex-start" className="archive-page-header" wrap="wrap">
            <Stack gap={4}>
              <Group gap="sm">
                <ThemeIcon size="lg" radius="sm" variant="light" color="archive">
                  <Mail size={24} />
                </ThemeIcon>
                <Title order={2} className="archive-title">Email Templates</Title>
              </Group>
              <Text className="archive-muted">
                Preview the custom email templates used by RSVP, signup, contact, and order flows.
              </Text>
            </Stack>
            <Badge size="lg" variant="light" color="archive">
              {previews.length} templates
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
            {previews.map((preview) => (
              <Paper key={preview.key} withBorder radius="sm" p="md" className="parchment-card">
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start" gap="md">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Group gap="xs">
                        <Title order={3} size="h4">{preview.title}</Title>
                        <Badge size="xs" variant="light" color="archive">{preview.key}</Badge>
                      </Group>
                      <Text size="sm" c="dimmed">{preview.trigger}</Text>
                    </Stack>
                    <ThemeIcon variant="light" color="archive" radius="sm">
                      <FileCode2 size={16} />
                    </ThemeIcon>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    <Meta label="Recipient" value={preview.recipient} />
                    <Meta label="Subject" value={preview.subject} />
                    <Meta label="Source" value={preview.source} />
                    <Meta label="Delivery" value="Rendered here, then sent with SendGrid mail send" />
                  </SimpleGrid>

                  <Box
                    style={{
                      border: "1px solid var(--ig-gold)",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <iframe
                      title={`${preview.title} preview`}
                      srcDoc={preview.html}
                      style={{
                        width: "100%",
                        height: 620,
                        border: 0,
                        display: "block",
                        background: "#fff",
                      }}
                    />
                  </Box>

                  {preview.key === "welcome" && (
                    <Box
                      component="details"
                      style={{
                        border: "1px solid rgba(183, 154, 85, 0.45)",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.58)",
                      }}
                    >
                      <Box
                        component="summary"
                        style={{
                          cursor: "pointer",
                          padding: "12px 14px",
                          fontFamily: "Arial, Helvetica, sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        Open new member editor
                      </Box>
                      <Box p="sm">
                        <EditableTemplateEditor
                          templateKey="welcome"
                          title="New Member Editor"
                          description="Edit only the saved body, links, and media used by the account-created welcome email."
                          initialHtml={signupPreviewHtml}
                          defaultBodyText={defaultWelcomeBody}
                          defaultLinks={defaultWelcomeLinks}
                        />
                      </Box>
                    </Box>
                  )}

                  {preview.key === "newsletter" && (
                    <Box
                      component="details"
                      style={{
                        border: "1px solid rgba(183, 154, 85, 0.45)",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.58)",
                      }}
                    >
                      <Box
                        component="summary"
                        style={{
                          cursor: "pointer",
                          padding: "12px 14px",
                          fontFamily: "Arial, Helvetica, sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        Open newsletter editor
                      </Box>
                      <Box p="sm">
                        <EditableTemplateEditor
                          templateKey="newsletter"
                          title="Newsletter Editor"
                          description="Edit the saved body, links, and media for subscriber newsletter/update emails."
                          initialHtml={newsletterPreviewHtml}
                          defaultBodyText={defaultNewsletterBody}
                          defaultLinks={defaultNewsletterLinks}
                        />
                      </Box>
                    </Box>
                  )}
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: "0.06em" }}>
        {label}
      </Text>
      <Text size="sm" style={{ overflowWrap: "anywhere" }}>{value}</Text>
    </Stack>
  );
}
