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
      // 方法1: 直接调用数据库清理（推荐）
      await cleanupExpiredCardKeysDirectly(env.DB);
      
      // 方法2: 调用API接口清理（备用）
      // await cleanupExpiredCardKeysViaAPI(env.SITE_URL);
      
    } catch (error) {
      console.error("❌ 卡密清理定时任务执行失败:", error);
      throw error;
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    // 手动触发清理任务的HTTP接口
    if (request.method === "POST") {
      try {
        console.log("🔧 手动触发卡密清理任务");
        const result = await cleanupExpiredCardKeysDirectly(env.DB);
        
        return new Response(JSON.stringify({
          success: true,
          message: `成功清理 ${result.deletedCount} 个过期卡密`,
          data: result
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        console.error("❌ 手动清理失败:", error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "清理失败"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Card Key Cleanup Worker", { status: 200 });
  },
};

/**
 * 直接通过数据库清理过期卡密
 */
async function cleanupExpiredCardKeysDirectly(db: D1Database) {
  console.log("🗑️ 开始直接清理过期卡密");
  
  const now = new Date().toISOString();
  
  // 查找过期的卡密
  const expiredCardKeysQuery = `
    SELECT id, code, email_address, is_used, expires_at 
    FROM card_keys 
    WHERE expires_at < ?
  `;
  
  const expiredCardKeys = await db.prepare(expiredCardKeysQuery)
    .bind(now)
    .all();

  console.log(`📊 找到 ${expiredCardKeys.results.length} 个过期卡密`);

  if (expiredCardKeys.results.length === 0) {
    return { deletedCount: 0, details: [] };
  }

  // 删除过期的卡密
  const deletedCardKeys = [];
  for (const cardKey of expiredCardKeys.results) {
    try {
      await db.prepare("DELETE FROM card_keys WHERE id = ?")
        .bind(cardKey.id)
        .run();
      
      deletedCardKeys.push({
        code: cardKey.code,
        emailAddress: cardKey.email_address,
        isUsed: cardKey.is_used,
        expiresAt: cardKey.expires_at,
      });
      
      console.log(`✅ 删除过期卡密: ${cardKey.code}`);
    } catch (error) {
      console.error(`❌ 删除卡密失败: ${cardKey.code}`, error);
    }
  }

  console.log(`🎉 成功清理 ${deletedCardKeys.length} 个过期卡密`);
  return { deletedCount: deletedCardKeys.length, details: deletedCardKeys };
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
