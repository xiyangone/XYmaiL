import { NextResponse } from "next/server";
import {
  cleanupExpiredTempAccounts,
  cleanupExpiredCardKeys,
} from "@/lib/card-keys";

export const runtime = "edge";

export async function POST() {
  try {
    const cleanedTempAccounts = await cleanupExpiredTempAccounts();
    const cleanedExpiredCardKeys = await cleanupExpiredCardKeys();

    return NextResponse.json({
      success: true,
      message: `清理了 ${cleanedTempAccounts} 个过期临时账号，删除了 ${cleanedExpiredCardKeys} 个过期未使用卡密`,
      cleanedTempAccounts,
      cleanedExpiredCardKeys,
    });
  } catch (error) {
    console.error("清理过期资源失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "清理失败",
      },
      { status: 500 }
    );
  }
}

// 支持定时任务调用
export async function GET() {
  return POST();
}
