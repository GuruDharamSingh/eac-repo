import { nanoid } from "nanoid";
import { db } from "@elkdonis/db";
import type { EmailLinkItem, EmailMediaItem } from "@elkdonis/email";

export const EMAIL_TEMPLATE_ORG_ID = "inner_group";
export const SIGNUP_WELCOME_TEMPLATE_KEY = "welcome";
export const NEWSLETTER_TEMPLATE_KEY = "newsletter";
export const RSVP_OWNER_TEMPLATE_KEY = "rsvp-owner";

export interface EmailTemplateConfig {
  bodyText?: string;
  links?: EmailLinkItem[];
  media?: EmailMediaItem[];
}

export interface EmailTemplateSettings {
  orgId: string;
  templateKey: string;
  config: EmailTemplateConfig;
  updatedAt: string;
  updatedBy?: string | null;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function cleanTemplateConfig(value: unknown): EmailTemplateConfig {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  const links = Array.isArray(source.links)
    ? source.links
        .map((item) => {
          const link = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            label: cleanText(link.label) ?? "",
            url: cleanText(link.url) ?? "",
          };
        })
        .filter((item) => item.label && item.url)
    : [];

  const media = Array.isArray(source.media)
    ? source.media
        .map((item) => {
          const mediaItem = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
          return {
            url: cleanText(mediaItem.url) ?? "",
            alt: cleanText(mediaItem.alt),
            caption: cleanText(mediaItem.caption),
          };
        })
        .filter((item) => item.url)
    : [];

  return {
    bodyText: cleanText(source.bodyText),
    links,
    media,
  };
}

export async function getEmailTemplateSettings(
  orgId: string,
  templateKey: string
): Promise<EmailTemplateSettings | null> {
  const [row] = await db`
    SELECT org_id, template_key, config, updated_at, updated_by
    FROM email_template_settings
    WHERE org_id = ${orgId} AND template_key = ${templateKey}
  `;

  if (!row) return null;

  return {
    orgId: row.org_id as string,
    templateKey: row.template_key as string,
    config: cleanTemplateConfig(row.config),
    updatedAt: String(row.updated_at),
    updatedBy: (row.updated_by as string | null) ?? null,
  };
}

export async function saveEmailTemplateSettings(params: {
  orgId: string;
  templateKey: string;
  config: EmailTemplateConfig;
  userId?: string | null;
}): Promise<EmailTemplateSettings> {
  const config = cleanTemplateConfig(params.config);
  const [row] = await db`
    INSERT INTO email_template_settings (id, org_id, template_key, config, created_by, updated_by)
    VALUES (
      ${`ets_${nanoid(18)}`},
      ${params.orgId},
      ${params.templateKey},
      ${JSON.stringify(config)}::jsonb,
      ${params.userId ?? null},
      ${params.userId ?? null}
    )
    ON CONFLICT (org_id, template_key)
    DO UPDATE SET
      config = EXCLUDED.config,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING org_id, template_key, config, updated_at, updated_by
  `;

  return {
    orgId: row.org_id as string,
    templateKey: row.template_key as string,
    config: cleanTemplateConfig(row.config),
    updatedAt: String(row.updated_at),
    updatedBy: (row.updated_by as string | null) ?? null,
  };
}
