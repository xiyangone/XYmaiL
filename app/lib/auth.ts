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

// 读取环境变量（优先 process.env，其次 Cloudflare Pages Functions 的 runtime env）
function readEnv(key: string): string | undefined {
  const fromProcess = (globalThis as any).process?.env?.[key] as
    | string
    | undefined;
  if (fromProcess) return fromProcess;
  try {
    const runtimeEnv = (getRequestContext() as any)?.env as Record<string, any>;
    return (runtimeEnv?.[key] as string) ?? undefined;
  } catch {
    return undefined;
  }
}

// 动态读取环境变量的函数，用于运行时获取
function getEnvVar(key: string): string | undefined {
  // 首先尝试从 process.env 读取
  const fromProcess = (globalThis as any).process?.env?.[key] as
    | string
    | undefined;
  if (fromProcess) return fromProcess;

  // 然后尝试从 Cloudflare runtime env 读取
  try {
    const runtimeEnv = (getRequestContext() as any)?.env as Record<string, any>;
    return (runtimeEnv?.[key] as string) ?? undefined;
  } catch {
    return undefined;
  }
}

// 初始化时尝试读取环境变量，但允许运行时重新获取
const AUTH_SECRET = readEnv("AUTH_SECRET") ?? readEnv("NEXTAUTH_SECRET");
const AUTH_GITHUB_ID = readEnv("AUTH_GITHUB_ID") ?? readEnv("GITHUB_ID");
const AUTH_GITHUB_SECRET =
  readEnv("AUTH_GITHUB_SECRET") ?? readEnv("GITHUB_SECRET");

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

// 获取最终的 AUTH_SECRET，优先使用运行时环境变量
function getFinalAuthSecret(): string | undefined {
  const runtimeSecret =
    getEnvVar("AUTH_SECRET") ?? getEnvVar("NEXTAUTH_SECRET");
  const finalSecret = runtimeSecret ?? AUTH_SECRET;

  console.log("[AUTH] 最终环境变量检查", {
    hasSecret: !!finalSecret,
    secretLength: finalSecret?.length || 0,
    source: runtimeSecret ? "运行时" : "初始化",
    hasRuntimeSecret: !!runtimeSecret,
    hasInitSecret: !!AUTH_SECRET,
  });

  return finalSecret;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  secret: getFinalAuthSecret(),
  // 允许在反向代理/Edge 环境下基于请求头动态推断主机名（当未设置 NEXTAUTH_URL 时尤为重要）
  trustHost: true,
  // 临时日志：仅用于排查凭证回调/会话签发问题（部署稳定后可移除或降级）
  logger: {
    error: (...args) => {
      console.error("[auth.error]", ...args);
      // 特别记录 Configuration 错误
      if (args.some((arg) => String(arg).includes("Configuration"))) {
        console.error(
          "[auth.error] 🚨 Configuration错误 - 检查AUTH_SECRET环境变量"
        );
        console.error("[auth.error] 当前环境变量状态:", {
          hasProcessEnvSecret: !!(globalThis as any).process?.env?.AUTH_SECRET,
          hasRuntimeSecret: (() => {
            try {
              return !!(getRequestContext() as any)?.env?.AUTH_SECRET;
            } catch {
              return false;
            }
          })(),
        });
      }
    },
    warn: (...args) => console.warn("[auth.warn]", ...args),
    debug: (...args) => console.debug("[auth.debug]", ...args),
  },
  providers: [
    ...(AUTH_GITHUB_ID && AUTH_GITHUB_SECRET
      ? [
          GitHub({
            clientId: AUTH_GITHUB_ID,
            clientSecret: AUTH_GITHUB_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        // 支持两种方式：1) 用户名/密码 2) 卡密
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
        cardKey: {
          label: "卡密",
          type: "text",
          placeholder: "XYMAIL-XXXX-XXXX-XXXX",
        },
      },
      async authorize(credentials) {
        if (!credentials) throw new Error("请输入登录信息");

        // 分支A：卡密登录
        if (credentials.cardKey && String(credentials.cardKey).trim()) {
          console.log("[AUTH] 卡密登录(Credentials)", {
            cardKey: "***" + String(credentials.cardKey).slice(-4),
          });
          try {
            const result = await activateCardKey(String(credentials.cardKey));
            const db = createDb();
            const user = await db.query.users.findFirst({
              where: eq(users.id, result.userId),
            });
            if (!user) throw new Error("用户创建失败");
            return { ...user, password: undefined } as any;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "卡密登录失败";
            console.warn("[AUTH] 卡密登录失败(Credentials)", msg);
            throw new Error(msg);
          }
        }

        // 分支B：用户名/密码
        const { username, password } = credentials as any;
        if (!username || !password) throw new Error("请输入用户名和密码");

        try {
          authSchema.parse({ username, password });
        } catch {
          throw new Error("输入格式不正确");
        }

        const db = createDb();
        const user = await db.query.users.findFirst({
          where: eq(users.username, String(username)),
        });
        if (!user) throw new Error("用户名或密码错误");

        const isValid = await comparePassword(
          String(password),
          user.password as string
        );
        if (!isValid) throw new Error("用户名或密码错误");

        return { ...user, password: undefined } as any;
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
      // 第一次登录（含 OAuth）时，尝试将 token 绑定到本地 DB 的用户ID
      if (user) {
        try {
          const db = createDb();
          let dbUser: any = null;
          // 优先用邮箱匹配到本地用户（OAuth 常见）
          if ((user as any).email) {
            dbUser = await db.query.users.findFirst({
              where: eq(users.email, (user as any).email as string),
            });
          }
          // 再尝试用 username（凭证/卡密登录常见）
          if (!dbUser && (user as any).username) {
            dbUser = await db.query.users.findFirst({
              where: eq(users.username, (user as any).username as string),
            });
          }

          if (dbUser) {
            token.id = dbUser.id;
            token.name =
              dbUser.name ||
              dbUser.username ||
              (user as any).name ||
              (user as any).username;
            token.username = dbUser.username || (user as any).username;
            token.image =
              dbUser.image ||
              (user as any).image ||
              generateAvatarUrl((token.name as string) || "user");
          } else {
            // 兜底：保留 NextAuth 提供的 user 字段（凭证登录会带有 id）
            token.id = (user as any).id;
            token.name = (user as any).name || (user as any).username;
            token.username = (user as any).username;
            token.image =
              (user as any).image ||
              generateAvatarUrl(((user as any).name as string) || "user");
          }
        } catch (e) {
          // 出错时不吞异常，打印日志并保持原始 token，避免阻断登录流程
          console.warn("[auth.jwt] ", e);
          token.id = (user as any).id ?? token.id;
          token.name = (user as any).name ?? token.name;
          token.username = (user as any).username ?? token.username;
          token.image = (user as any).image ?? token.image;
        }
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
