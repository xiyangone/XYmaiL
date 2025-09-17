import { NextResponse } from "next/server";
import { auth, checkPermission } from "@/lib/auth";
import { PERMISSIONS, ROLES } from "@/lib/permissions";
import { generateBatchCardKeys } from "@/lib/card-keys";
import { z } from "zod";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { createDb } from "@/lib/db";
import { emails, userRoles } from "@/lib/schema";
import { inArray } from "drizzle-orm";

export const runtime = "edge";

const generateCardKeysSchema = z.object({
  emailAddresses: z
    .array(z.string().email("无效的邮箱地址"))
    .min(1, "至少需要一个邮箱地址"),
  expiryDays: z
    .number()
    .min(1, "过期天数必须大于0")
    .max(365, "过期天数不能超过365天")
    .optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 检查权限 - 只有皇帝可以生成卡密
    const hasPermission = await checkPermission(PERMISSIONS.MANAGE_CARD_KEYS);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "权限不足，只有皇帝可以生成卡密" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = generateCardKeysSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { emailAddresses, expiryDays } = validation.data;

    // 先检查邮箱是否已被其它用户占用（皇帝占用允许通过，其它用户占用直接阻止生成）
    const db = createDb();
    const existingEmails = await db.query.emails.findMany({
      where: inArray(emails.address, emailAddresses),
    });

    if (existingEmails.length > 0) {
      const ownerIds = Array.from(
        new Set(existingEmails.map((e) => e.userId).filter(Boolean))
      ) as string[];

      const emperorOwnerIds = new Set<string>();
      if (ownerIds.length > 0) {
        const ownerRoles = await db.query.userRoles.findMany({
          where: inArray(userRoles.userId, ownerIds),
          with: { role: true },
        });
        for (const or of ownerRoles) {
          if (or.role?.name === ROLES.EMPEROR) emperorOwnerIds.add(or.userId);
        }
      }

      const occupiedByOthers = existingEmails
        .filter((e) => !emperorOwnerIds.has(e.userId!))
        .map((e) => e.address);

      if (occupiedByOthers.length > 0) {
        return NextResponse.json(
          {
            error:
              "以下邮箱已被其他用户占用，无法生成对应卡密：" +
              occupiedByOthers.join(", "),
          },
          { status: 400 }
        );
      }
    }

    // 若未显式传入，使用 KV 中的默认天数（CARD_KEY_DEFAULT_DAYS，默认 7）
    const env = getRequestContext().env;
    const cfgDefaultDays = await env.SITE_CONFIG.get("CARD_KEY_DEFAULT_DAYS");
    const finalExpiryDays = Number(expiryDays ?? cfgDefaultDays ?? 7);

    // 生成卡密
    const cardKeys = await generateBatchCardKeys(
      emailAddresses,
      finalExpiryDays
    );

    return NextResponse.json({
      success: true,
      cardKeys,
      message: `成功生成 ${cardKeys.length} 个卡密`,
    });
  } catch (error) {
    console.error("生成卡密失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成卡密失败" },
      { status: 500 }
    );
  }
}
