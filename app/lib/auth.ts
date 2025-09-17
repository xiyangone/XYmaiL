import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
// 移除 DrizzleAdapter，避免在构建期创建 DB 连接
import { createDb, Db } from "./db";
import { users, roles, userRoles } from "./schema";
import { eq } from "drizzle-orm";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { Permission, hasPermission, ROLES, Role } from "./permissions";
import CredentialsProvider from "next-auth/providers/credentials";
import { hashPassword, comparePassword } from "@/lib/utils";
import { authSchema } from "@/lib/validation";
import { generateAvatarUrl } from "./avatar";
import { getUserId } from "./apiKey";
import { activateCardKey } from "./card-keys";

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [ROLES.EMPEROR]: "皇帝（网站所有者）",
  [ROLES.DUKE]: "公爵（超级用户）",
  [ROLES.KNIGHT]: "骑士（高级用户）",
  [ROLES.CIVILIAN]: "平民（普通用户）",
  [ROLES.TEMP_USER]: "临时用户（卡密用户）",
};

const getDefaultRole = async (env?: any): Promise<Role> => {
  try {
    if (!env) {
      // 如果没有传入env，尝试获取，但要处理可能的错误
      try {
        env = getRequestContext().env;
      } catch {
        // 如果获取失败，返回默认角色
        return ROLES.CIVILIAN;
      }
    }

    const defaultRole = await env.SITE_CONFIG?.get("DEFAULT_ROLE");

    if (
      defaultRole === ROLES.DUKE ||
      defaultRole === ROLES.KNIGHT ||
      defaultRole === ROLES.CIVILIAN
    ) {
      return defaultRole as Role;
    }
  } catch (error) {
    console.warn("获取默认角色失败，使用CIVILIAN:", error);
  }

  return ROLES.CIVILIAN;
};

async function findOrCreateRole(db: Db, roleName: Role) {
  let role = await db.query.roles.findFirst({
    where: eq(roles.name, roleName),
  });

  if (!role) {
    const [newRole] = await db
      .insert(roles)
      .values({
        name: roleName,
        description: ROLE_DESCRIPTIONS[roleName],
      })
      .returning();
    role = newRole;
  }

  return role;
}

export async function assignRoleToUser(db: Db, userId: string, roleId: string) {
  await db.delete(userRoles).where(eq(userRoles.userId, userId));

  await db.insert(userRoles).values({
    userId,
    roleId,
  });
}

export async function getUserRole(userId: string) {
  const db = createDb();
  const userRoleRecords = await db.query.userRoles.findMany({
    where: eq(userRoles.userId, userId),
    with: { role: true },
  });
  return userRoleRecords[0].role.name;
}

export async function checkPermission(permission: Permission) {
  const userId = await getUserId();

  if (!userId) return false;

  const db = createDb();
  const userRoleRecords = await db.query.userRoles.findMany({
    where: eq(userRoles.userId, userId),
    with: { role: true },
  });

  const userRoleNames = userRoleRecords.map((ur) => ur.role.name);
  return hasPermission(userRoleNames as Role[], permission);
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  secret: process.env.AUTH_SECRET,
  // 允许在反向代理/Edge 环境下基于请求头动态推断主机名（当未设置 NEXTAUTH_URL 时尤为重要）
  trustHost: true,
  providers: [
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
      ? [
          GitHub({
            clientId: process.env.AUTH_GITHUB_ID!,
            clientSecret: process.env.AUTH_GITHUB_SECRET!,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: {
          label: "用户名",
          type: "text",
          placeholder: "请输入用户名",
        },
        password: {
          label: "密码",
          type: "password",
          placeholder: "请输入密码",
        },
      },
      async authorize(credentials) {
        if (!credentials) {
          throw new Error("请输入用户名和密码");
        }

        const { username, password } = credentials;

        try {
          authSchema.parse({ username, password });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          throw new Error("输入格式不正确");
        }

        const db = createDb();

        const user = await db.query.users.findFirst({
          where: eq(users.username, username as string),
        });

        if (!user) {
          throw new Error("用户名或密码错误");
        }

        const isValid = await comparePassword(
          password as string,
          user.password as string
        );
        if (!isValid) {
          throw new Error("用户名或密码错误");
        }

        return {
          ...user,
          password: undefined,
        };
      },
    }),
    CredentialsProvider({
      id: "card-key",
      name: "卡密登录",
      credentials: {
        cardKey: {
          label: "卡密",
          type: "text",
          placeholder: "请输入卡密",
        },
      },
      async authorize(credentials) {
        console.log("[AUTH] 卡密登录开始", {
          cardKey: credentials?.cardKey
            ? "***" + (credentials.cardKey as string).slice(-4)
            : "未提供",
        });

        if (!credentials?.cardKey) {
          console.log("[AUTH] 卡密登录失败: 未提供卡密");
          throw new Error("请输入卡密");
        }

        const { cardKey } = credentials;

        try {
          console.log("[AUTH] 开始验证卡密", {
            cardKey: "***" + (cardKey as string).slice(-4),
          });
          // 验证并使用卡密
          const result = await activateCardKey(cardKey as string);
          console.log("[AUTH] 卡密验证成功", {
            userId: result.userId,
            emailAddress: result.emailAddress,
          });

          // 获取创建的用户信息
          const db = createDb();
          const user = await db.query.users.findFirst({
            where: eq(users.id, result.userId),
          });

          if (!user) {
            throw new Error("用户创建失败");
          }

          return {
            ...user,
            password: undefined,
          };
        } catch (error) {
          console.log("[AUTH] 卡密验证失败", {
            error: error instanceof Error ? error.message : "未知错误",
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw new Error(
            error instanceof Error ? error.message : "卡密验证失败"
          );
        }
      },
    }),
  ],
  //  
  //  
  //  
  //  
  //  
  //  
  //  
  //  
  //  
  // : 
  // : 
  // : 
  // : 
  // : 
  // : 
  // 
  events: {
    async signIn({ user }) {
      try {
        const db = createDb();

        // 1) 确保 OAuth 用户也在本地 users 表中存在（无 Adapter 模式）
        let dbUser = null as any;
        if (user?.email) {
          dbUser = await db.query.users.findFirst({
            where: eq(users.email, user.email as string),
          });
        }
        if (!dbUser && user?.username) {
          dbUser = await db.query.users.findFirst({
            where: eq(users.username, user.username as string),
          });
        }

        if (!dbUser) {
          // 构造安全的 username
          const base = (user?.username ||
            (user?.email
              ? (user.email as string).split("@")[0]
              : "gh")) as string;
          const clean =
            base.replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, 24) || "gh";
          const unique = `${clean}_${(
            globalThis.crypto?.randomUUID?.() ||
            Math.random().toString(36).slice(2, 8)
          ).slice(0, 6)}`;

          const inserted = await db
            .insert(users)
            .values({
              name: (user?.name as string) || null,
              email: (user?.email as string) || null,
              image: (user?.image as string) || null,
              username: unique,
            })
            .returning();
          dbUser = inserted?.[0];
        }

        const uid = (user?.id as string) || dbUser?.id;
        if (!uid) return;

        // 2) 若已分配角色则跳过
        const existingRole = await db.query.userRoles.findFirst({
          where: eq(userRoles.userId, uid),
        });
        if (existingRole) return;

        // 3) 分配默认角色
        const defaultRole = await getDefaultRole();
        const role = await findOrCreateRole(db, defaultRole);
        await assignRoleToUser(db, uid, role.id);
        return;
      } catch (error) {
        console.error("Error in signIn event:", error);
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name || user.username;
        token.username = user.username;
        token.image = user.image || generateAvatarUrl(token.name as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.username = token.username as string;
        session.user.image = token.image as string;

        const db = createDb();
        let userRoleRecords = await db.query.userRoles.findMany({
          where: eq(userRoles.userId, session.user.id),
          with: { role: true },
        });

        if (!userRoleRecords.length) {
          const defaultRole = await getDefaultRole();
          const role = await findOrCreateRole(db, defaultRole);
          await assignRoleToUser(db, session.user.id, role.id);
          userRoleRecords = [
            {
              userId: session.user.id,
              roleId: role.id,
              createdAt: new Date(),
              role: role,
            },
          ];
        }

        session.user.roles = userRoleRecords.map((ur) => ({
          name: ur.role.name,
        }));
      }

      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});

export async function register(username: string, password: string) {
  const db = createDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existing) {
    throw new Error("用户名已存在");
  }

  const hashedPassword = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      username,
      password: hashedPassword,
    })
    .returning();

  return user;
}
