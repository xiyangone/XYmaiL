import { NextResponse } from "next/server";
import { createDb } from "@/lib/db";
import { users, userRoles, roles } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions";

export const runtime = "edge";

const roleDisplayNames: Record<string, string> = {
  emperor: "皇帝",
  duke: "公爵",
  knight: "骑士",
  civilian: "平民",
  temp_user: "临时用户",
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // Check if user has permission to manage users
    const db = createDb();
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const userRoleNames = currentUser.userRoles.map(
      (ur) => ur.role.name
    ) as string[];
    if (!hasPermission(userRoleNames as any, PERMISSIONS.PROMOTE_USER)) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    // Get all users with their roles
    const allUsers = await db.query.users.findMany({
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
      orderBy: [desc(users.id)],
    });

    const usersWithRoles = allUsers.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      image: user.image,
      role: user.userRoles[0]?.role.name || "civilian",
      roleName:
        roleDisplayNames[user.userRoles[0]?.role.name || "civilian"] || "平民",
      createdAt: user.userRoles[0]?.createdAt,
    }));

    return NextResponse.json({ users: usersWithRoles });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "获取用户列表失败" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { userId, newRole } = (await request.json()) as {
      userId: string;
      newRole: string;
    };

    if (!userId || !newRole) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const db = createDb();

    // Check if current user has permission to promote users
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const userRoleNames = currentUser.userRoles.map(
      (ur) => ur.role.name
    ) as string[];
    if (!hasPermission(userRoleNames as any, PERMISSIONS.PROMOTE_USER)) {
      return NextResponse.json({ error: "权限不足" }, { status: 403 });
    }

    // Get the target role
    const targetRole = await db.query.roles.findFirst({
      where: eq(roles.name, newRole),
    });

    if (!targetRole) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }

    // Check if target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: "目标用户不存在" }, { status: 404 });
    }

    // Remove existing role
    await db.delete(userRoles).where(eq(userRoles.userId, userId));

    // Add new role
    await db.insert(userRoles).values({
      userId: userId,
      roleId: targetRole.id,
    });

    return NextResponse.json({
      success: true,
      message: `用户角色已更新为 ${
        roleDisplayNames[targetRole.name] || targetRole.name
      }`,
    });
  } catch (error) {
    console.error("Failed to update user role:", error);
    return NextResponse.json({ error: "更新用户角色失败" }, { status: 500 });
  }
}
