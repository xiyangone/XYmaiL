import { createDb } from "./db";
import { cardKeys, tempAccounts, users, emails, roles } from "./schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { ROLES } from "./permissions";
import { assignRoleToUser } from "./auth";

/**
 * 生成卡密代码
 */
export function generateCardKeyCode(): string {
  const prefix = "XYMAIL";
  const segments = Array.from({ length: 3 }, () => nanoid(4).toUpperCase());
  return `${prefix}-${segments.join("-")}`;
}

/**
 * 验证卡密是否有效
 */
export async function validateCardKey(code: string) {
  const db = createDb();

  const cardKey = await db.query.cardKeys.findFirst({
    where: eq(cardKeys.code, code),
  });

  if (!cardKey) {
    return { valid: false, error: "卡密不存在" };
  }

  if (cardKey.isUsed) {
    return { valid: false, error: "卡密已被使用" };
  }

  if (cardKey.expiresAt < new Date()) {
    return { valid: false, error: "卡密已过期" };
  }

  return { valid: true, cardKey };
}

/**
 * 使用卡密创建临时账号
 */
export async function activateCardKey(code: string) {
  const db = createDb();

  const validation = await validateCardKey(code);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const cardKey = validation.cardKey!;

  // 创建临时用户
  const tempUser = await db
    .insert(users)
    .values({
      name: `临时用户_${cardKey.emailAddress.split("@")[0]}`,
      email: cardKey.emailAddress,
      username: `temp_${nanoid(8)}`,
    })
    .returning();

  const userId = tempUser[0].id;

  // 分配临时用户角色
  const tempRole = await db.query.roles.findFirst({
    where: eq(roles.name, ROLES.TEMP_USER),
  });

  if (!tempRole) {
    // 如果临时用户角色不存在，创建它
    const [newRole] = await db
      .insert(roles)
      .values({
        name: ROLES.TEMP_USER,
        description: "临时用户，只能访问绑定的邮箱",
      })
      .returning();

    await assignRoleToUser(db, userId, newRole.id);
  } else {
    await assignRoleToUser(db, userId, tempRole.id);
  }

  // 创建绑定的邮箱地址
  const now = new Date();
  const emailExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

  await db.insert(emails).values({
    address: cardKey.emailAddress,
    userId: userId,
    createdAt: now,
    expiresAt: emailExpiresAt,
  });

  // 创建临时账号记录
  await db.insert(tempAccounts).values({
    userId: userId,
    cardKeyId: cardKey.id,
    emailAddress: cardKey.emailAddress,
    createdAt: now,
    expiresAt: emailExpiresAt,
  });

  // 标记卡密为已使用
  await db
    .update(cardKeys)
    .set({
      isUsed: true,
      usedBy: userId,
      usedAt: now,
    })
    .where(eq(cardKeys.id, cardKey.id));

  return {
    userId,
    emailAddress: cardKey.emailAddress,
    expiresAt: emailExpiresAt,
  };
}

/**
 * 检查用户是否为临时用户
 */
export async function isTempUser(userId: string): Promise<boolean> {
  const db = createDb();

  const tempAccount = await db.query.tempAccounts.findFirst({
    where: and(
      eq(tempAccounts.userId, userId),
      eq(tempAccounts.isActive, true),
      gt(tempAccounts.expiresAt, new Date())
    ),
  });

  return !!tempAccount;
}

/**
 * 获取临时用户绑定的邮箱地址
 */
export async function getTempUserEmailAddress(
  userId: string
): Promise<string | null> {
  const db = createDb();

  const tempAccount = await db.query.tempAccounts.findFirst({
    where: and(
      eq(tempAccounts.userId, userId),
      eq(tempAccounts.isActive, true),
      gt(tempAccounts.expiresAt, new Date())
    ),
  });

  return tempAccount?.emailAddress || null;
}

/**
 * 清理过期的临时账号
 */
export async function cleanupExpiredTempAccounts() {
  const db = createDb();
  const now = new Date();

  // 查找过期的临时账号
  const expiredAccounts = await db.query.tempAccounts.findMany({
    where: and(
      eq(tempAccounts.isActive, true),
      lt(tempAccounts.expiresAt, now)
    ),
  });

  for (const account of expiredAccounts) {
    // 删除用户及相关数据（级联删除会处理邮箱和消息）
    await db.delete(users).where(eq(users.id, account.userId));

    // 标记临时账号为非活跃
    await db
      .update(tempAccounts)
      .set({ isActive: false })
      .where(eq(tempAccounts.id, account.id));
  }

  return expiredAccounts.length;
}

/**
 * 生成批量卡密
 */
export async function generateBatchCardKeys(
  emailAddresses: string[],
  expiryDays: number = 30
): Promise<{ code: string; emailAddress: string }[]> {
  const db = createDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const cardKeyData = emailAddresses.map((emailAddress) => ({
    code: generateCardKeyCode(),
    emailAddress,
    expiresAt,
    createdAt: now,
  }));

  await db.insert(cardKeys).values(cardKeyData);

  return cardKeyData.map(({ code, emailAddress }) => ({ code, emailAddress }));
}
