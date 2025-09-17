import { createDb } from "@/lib/db";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { emails } from "@/lib/schema";
import { encodeCursor, decodeCursor } from "@/lib/cursor";
import { getUserId } from "@/lib/apiKey";
import { isTempUser, getTempUserEmailAddress } from "@/lib/card-keys";

export const runtime = "edge";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const userId = await getUserId();

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");

  const db = createDb();

  try {
    // 检查是否为临时用户
    const isTemp = await isTempUser(userId!);
    let baseConditions;

    if (isTemp) {
      // 临时用户只能看到绑定的邮箱
      const tempEmailAddress = await getTempUserEmailAddress(userId!);
      if (!tempEmailAddress) {
        return NextResponse.json({
          emails: [],
          nextCursor: null,
          total: 0,
        });
      }
      baseConditions = and(
        eq(emails.userId, userId!),
        eq(emails.address, tempEmailAddress),
        gt(emails.expiresAt, new Date())
      );
    } else {
      // 普通用户可以看到所有自己的邮箱
      baseConditions = and(
        eq(emails.userId, userId!),
        gt(emails.expiresAt, new Date())
      );
    }

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(baseConditions);
    const totalCount = Number(totalResult[0].count);

    const conditions = [baseConditions];

    if (cursor) {
      const { timestamp, id } = decodeCursor(cursor);
      conditions.push(
        or(
          lt(emails.createdAt, new Date(timestamp)),
          and(eq(emails.createdAt, new Date(timestamp)), lt(emails.id, id))
        )
      );
    }

    const results = await db.query.emails.findMany({
      where: and(...conditions),
      orderBy: (emails, { desc }) => [desc(emails.createdAt), desc(emails.id)],
      limit: PAGE_SIZE + 1,
    });

    const hasMore = results.length > PAGE_SIZE;
    const nextCursor = hasMore
      ? encodeCursor(
          results[PAGE_SIZE - 1].createdAt.getTime(),
          results[PAGE_SIZE - 1].id
        )
      : null;
    const emailList = hasMore ? results.slice(0, PAGE_SIZE) : results;

    return NextResponse.json({
      emails: emailList,
      nextCursor,
      total: totalCount,
    });
  } catch (error) {
    console.error("Failed to fetch user emails:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
