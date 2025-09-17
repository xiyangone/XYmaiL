import { NextResponse } from "next/server";
import { auth, checkPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { cleanupExpiredCardKeys } from "@/lib/card-keys";

export const runtime = "edge";

/**
 * 清理过期卡密的API接口
 * 只有皇帝角色可以调用
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "未授权" },
        { status: 401 }
      );
    }

    // 检查权限 - 只有皇帝可以清理卡密
    const hasPermission = await checkPermission(PERMISSIONS.MANAGE_CARD_KEYS);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "权限不足，只有皇帝可以清理卡密" },
        { status: 403 }
      );
    }

    console.log("[API] 开始手动清理过期卡密");
    const result = await cleanupExpiredCardKeys();

    return NextResponse.json({
      success: true,
      message: `成功清理 ${result.deletedCount} 个过期卡密`,
      data: {
        deletedCount: result.deletedCount,
        details: result.details,
      },
    });

  } catch (error) {
    console.error("清理过期卡密失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "清理过期卡密失败" },
      { status: 500 }
    );
  }
}

/**
 * 获取过期卡密统计信息
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "未授权" },
        { status: 401 }
      );
    }

    // 检查权限
    const hasPermission = await checkPermission(PERMISSIONS.MANAGE_CARD_KEYS);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "权限不足" },
        { status: 403 }
      );
    }

    const { createDb } = await import("@/lib/db");
    const { cardKeys } = await import("@/lib/schema");
    const { lt, count } = await import("drizzle-orm");

    const db = createDb();
    const now = new Date();

    // 统计过期卡密数量
    const expiredCount = await db
      .select({ count: count() })
      .from(cardKeys)
      .where(lt(cardKeys.expiresAt, now));

    // 统计总卡密数量
    const totalCount = await db
      .select({ count: count() })
      .from(cardKeys);

    return NextResponse.json({
      success: true,
      data: {
        expiredCount: expiredCount[0]?.count || 0,
        totalCount: totalCount[0]?.count || 0,
        lastChecked: now.toISOString(),
      },
    });

  } catch (error) {
    console.error("获取过期卡密统计失败:", error);
    return NextResponse.json(
      { error: "获取统计信息失败" },
      { status: 500 }
    );
  }
}
