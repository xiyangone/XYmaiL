import { PERMISSIONS, Role, ROLES } from "@/lib/permissions";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { EMAIL_CONFIG } from "@/config";
import { checkPermission } from "@/lib/auth";

export const runtime = "edge";

export async function GET() {
  const env = getRequestContext().env;
  const [
    defaultRole,
    emailDomains,
    adminContact,
    maxEmails,
    cleanupUsedExpired,
    cleanupExpiredEmails,
    cardKeyDefaultDays,
  ] = await Promise.all([
    env.SITE_CONFIG.get("DEFAULT_ROLE"),
    env.SITE_CONFIG.get("EMAIL_DOMAINS"),
    env.SITE_CONFIG.get("ADMIN_CONTACT"),
    env.SITE_CONFIG.get("MAX_EMAILS"),
    env.SITE_CONFIG.get("CLEANUP_DELETE_USED_EXPIRED_CARD_KEYS"),
    env.SITE_CONFIG.get("CLEANUP_DELETE_EXPIRED_EMAILS"),
    env.SITE_CONFIG.get("CARD_KEY_DEFAULT_DAYS"),
  ]);

  return Response.json({
    defaultRole: defaultRole || ROLES.CIVILIAN,
    emailDomains: emailDomains || "moemail.app",
    adminContact: adminContact || "",
    maxEmails: maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS.toString(),
    cleanupDeleteUsedExpiredCardKeys: (cleanupUsedExpired ?? "true").toString(),
    cleanupDeleteExpiredEmails: (cleanupExpiredEmails ?? "true").toString(),
    cardKeyDefaultDays: (cardKeyDefaultDays ?? "7").toString(),
  });
}

export async function POST(request: Request) {
  const canAccess = await checkPermission(PERMISSIONS.MANAGE_CONFIG);

  if (!canAccess) {
    return Response.json(
      {
        error: "权限不足",
      },
      { status: 403 }
    );
  }

  const {
    defaultRole,
    emailDomains,
    adminContact,
    maxEmails,
    cleanupDeleteUsedExpiredCardKeys,
    cleanupDeleteExpiredEmails,
    cardKeyDefaultDays,
  } = (await request.json()) as {
    defaultRole: Exclude<Role, typeof ROLES.EMPEROR>;
    emailDomains: string;
    adminContact: string;
    maxEmails: string;
    cleanupDeleteUsedExpiredCardKeys?: string | boolean;
    cleanupDeleteExpiredEmails?: string | boolean;
    cardKeyDefaultDays?: string | number;
  };

  if (
    ![ROLES.DUKE, ROLES.KNIGHT, ROLES.CIVILIAN].includes(
      defaultRole as
        | typeof ROLES.DUKE
        | typeof ROLES.KNIGHT
        | typeof ROLES.CIVILIAN
    )
  ) {
    return Response.json({ error: "无效的角色" }, { status: 400 });
  }

  const env = getRequestContext().env;
  await Promise.all([
    env.SITE_CONFIG.put("DEFAULT_ROLE", defaultRole),
    env.SITE_CONFIG.put("EMAIL_DOMAINS", emailDomains),
    env.SITE_CONFIG.put("ADMIN_CONTACT", adminContact),
    env.SITE_CONFIG.put("MAX_EMAILS", maxEmails),
    env.SITE_CONFIG.put(
      "CLEANUP_DELETE_USED_EXPIRED_CARD_KEYS",
      (typeof cleanupDeleteUsedExpiredCardKeys === "boolean"
        ? cleanupDeleteUsedExpiredCardKeys
        : cleanupDeleteUsedExpiredCardKeys ?? "true"
      ).toString()
    ),
    env.SITE_CONFIG.put(
      "CLEANUP_DELETE_EXPIRED_EMAILS",
      (typeof cleanupDeleteExpiredEmails === "boolean"
        ? cleanupDeleteExpiredEmails
        : cleanupDeleteExpiredEmails ?? "true"
      ).toString()
    ),
    env.SITE_CONFIG.put(
      "CARD_KEY_DEFAULT_DAYS",
      (cardKeyDefaultDays ?? "7").toString()
    ),
  ]);

  return Response.json({ success: true });
}
