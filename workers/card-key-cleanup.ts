/**
 * Cloudflare Worker 定时任务：自动清理过期卡密
 * 每天凌晨2点执行一次
 */

interface Env {
  SITE_URL: string;
  DB: D1Database;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log("🕐 开始执行卡密清理定时任务");

    try {
      // 直接调用数据库清理
      await cleanupExpiredDataDirectly(env.DB);
    } catch (error) {
      console.error("❌ 过期数据清理定时任务执行失败:", error);
      throw error;
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    // 手动触发清理任务的HTTP接口
    if (request.method === "POST") {
      try {
        console.log("🔧 手动触发过期数据清理任务");
        const result = await cleanupExpiredDataDirectly(env.DB);

        return new Response(
          JSON.stringify({
            success: true,
            message: `成功清理 ${result.tempAccounts.deletedCount} 个临时账号和 ${result.cardKeys.deletedCount} 个卡密`,
            data: result,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("❌ 手动清理失败:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "清理失败",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response("Card Key Cleanup Worker", { status: 200 });
  },
};

/**
 * 直接通过数据库清理过期卡密
 */
async function cleanupExpiredDataDirectly(db: D1Database) {
  console.log("🗑️ 开始直接清理过期数据");

  const now = new Date().toISOString();
  const results = {
    tempAccounts: { deletedCount: 0, details: [] as any[] },
    cardKeys: { deletedCount: 0, details: [] as any[] },
  };

  // 1. 清理过期临时账号
  const expiredAccountsQuery = `
    SELECT ta.id, ta.user_id, ta.email_address, ta.expires_at
    FROM temp_accounts ta
    WHERE ta.is_active = 1 AND ta.expires_at < ?
  `;

  const expiredAccounts = await db
    .prepare(expiredAccountsQuery)
    .bind(now)
    .all();

  console.log(`📊 找到 ${expiredAccounts.results.length} 个过期临时账号`);

  for (const account of expiredAccounts.results) {
    try {
      // 重置关联卡密状态
      await db
        .prepare(
          "UPDATE card_keys SET is_used = 0, used_by = NULL, used_at = NULL WHERE used_by = ?"
        )
        .bind(account.user_id)
        .run();

      // 删除用户
      await db
        .prepare("DELETE FROM users WHERE id = ?")
        .bind(account.user_id)
        .run();

      // 标记临时账号为非活跃
      await db
        .prepare("UPDATE temp_accounts SET is_active = 0 WHERE id = ?")
        .bind(account.id)
        .run();

      results.tempAccounts.details.push({
        userId: account.user_id,
        emailAddress: account.email_address,
      });

      console.log(`✅ 清理临时账号: ${account.email_address}`);
    } catch (error) {
      console.error(`❌ 清理临时账号失败: ${account.email_address}`, error);
    }
  }
  results.tempAccounts.deletedCount = results.tempAccounts.details.length;

  // 2. 清理过期卡密
  const expiredCardKeysQuery = `
    SELECT id, code, email_address, is_used, expires_at
    FROM card_keys
    WHERE expires_at < ?
  `;

  const expiredCardKeys = await db
    .prepare(expiredCardKeysQuery)
    .bind(now)
    .all();

  console.log(`📊 找到 ${expiredCardKeys.results.length} 个过期卡密`);

  for (const cardKey of expiredCardKeys.results) {
    try {
      await db
        .prepare("DELETE FROM card_keys WHERE id = ?")
        .bind(cardKey.id)
        .run();

      results.cardKeys.details.push({
        code: cardKey.code,
        emailAddress: cardKey.email_address,
        isUsed: cardKey.is_used,
      });

      console.log(`✅ 删除过期卡密: ${cardKey.code}`);
    } catch (error) {
      console.error(`❌ 删除卡密失败: ${cardKey.code}`, error);
    }
  }
  results.cardKeys.deletedCount = results.cardKeys.details.length;

  console.log(
    `🎉 清理完成 - 临时账号: ${results.tempAccounts.deletedCount}, 卡密: ${results.cardKeys.deletedCount}`
  );
  return results;
}

/**
 * 通过API接口清理过期卡密（备用方案）
 */
async function cleanupExpiredCardKeysViaAPI(siteUrl: string) {
  console.log("🌐 通过API清理过期卡密");

  const response = await fetch(`${siteUrl}/api/cleanup/card-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 注意：这里需要适当的认证机制
      // "Authorization": "Bearer " + apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API清理失败: ${response.status} ${error}`);
  }

  const result = await response.json();
  console.log("🎉 API清理完成:", result);
  return result;
}
