import sgMail from '@sendgrid/mail';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set — skipping');
    return;
  }

  sgMail.setApiKey(apiKey);

  const fromEmail = opts.fromEmail ?? process.env.EMAIL_FROM ?? 'info@em6860.elkdonis-arts.org';
  const fromName = opts.fromName ?? process.env.EMAIL_FROM_NAME ?? 'Elkdonis Arts Collective';

  await sgMail.send({
    to: opts.to,
    from: { email: fromEmail, name: fromName },
    subject: opts.subject,
    html: opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  });
}
