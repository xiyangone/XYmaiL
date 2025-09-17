import { NextResponse } from "next/server"
import { cleanupExpiredTempAccounts } from "@/lib/card-keys"

export const runtime = "edge"

export async function POST() {
  try {
    const cleanedCount = await cleanupExpiredTempAccounts()
    
    return NextResponse.json({
      success: true,
      message: `清理了 ${cleanedCount} 个过期临时账号`,
      cleanedCount
    })
  } catch (error) {
    console.error("清理过期临时账号失败:", error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "清理失败" 
      },
      { status: 500 }
    )
  }
}

// 支持定时任务调用
export async function GET() {
  return POST()
}
