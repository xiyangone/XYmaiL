# Cloudflare 生产环境卡密登录问题诊断指南

## 🚨 当前问题
1. 卡密登录返回 `Configuration` 错误
2. Cloudflare Insights 脚本被浏览器扩展拦截

## 🔍 问题1：Configuration 错误解决方案

### 步骤1：检查 Cloudflare Pages 环境变量

1. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com/
   - 进入 Pages 项目

2. **检查环境变量设置**
   - 点击项目名称
   - 进入 "Settings" → "Environment variables"
   - 确认以下变量存在：
     ```
     AUTH_SECRET = "至少32字符的随机字符串"
     ```

3. **如果环境变量不存在，手动添加**：
   - 点击 "Add variable"
   - 变量名：`AUTH_SECRET`
   - 变量值：生成一个安全的密钥（建议64字符）
   - 环境：选择 "Production" 和 "Preview"
   - 点击 "Save"

### 步骤2：生成安全的 AUTH_SECRET

使用以下方法之一生成：

**方法1：在线生成**
```bash
# 访问 https://generate-secret.vercel.app/32
# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**方法2：使用 OpenSSL**
```bash
openssl rand -hex 32
```

### 步骤3：重新部署

设置环境变量后，必须重新部署：
- 在 Cloudflare Pages 项目中点击 "Create deployment"
- 或推送新的代码到 GitHub 触发自动部署

### 步骤4：验证修复

1. **检查 Functions 日志**：
   - 在 Cloudflare Dashboard 中进入 "Functions" → "Real-time logs"
   - 尝试卡密登录，查看是否有 `[AUTH] 最终环境变量检查` 日志

2. **测试登录流程**：
   - 使用隐身窗口访问网站
   - 尝试卡密登录
   - 检查 Network 面板中 `/api/auth/callback/credentials` 的响应

## 🔍 问题2：Cloudflare Insights 拦截解决方案

### 方法1：禁用 Cloudflare Web Analytics（推荐）

1. **在 Cloudflare Dashboard 中**：
   - 进入域名管理
   - 点击 "Analytics & Logs" → "Web Analytics"
   - 关闭 Web Analytics 功能

### 方法2：配置浏览器扩展白名单

1. **如果使用 uBlock Origin**：
   - 点击扩展图标
   - 点击 "禁用此网站的拦截"

2. **如果使用 AdBlock Plus**：
   - 将您的域名添加到白名单

### 方法3：在代码中禁用 Insights（临时方案）

如果需要完全禁用，可以在 `next.config.ts` 中添加：

```typescript
const nextConfig: NextConfig = {
  // 其他配置...
  
  // 禁用 Cloudflare Insights
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'CF-Insights',
            value: 'off',
          },
        ],
      },
    ]
  },
}
```

## 🧪 完整测试流程

1. **清理浏览器状态**：
   - 使用隐身窗口
   - 或清理 Cookies：`__Secure-authjs.callback-url`、`__Host-authjs.csrf-token`

2. **检查 CSRF 端点**：
   - 访问 `https://你的域名/api/auth/csrf`
   - 应该返回 `{"csrfToken": "..."}`

3. **测试卡密登录**：
   - 打开 Network 面板
   - 输入卡密并登录
   - 检查 `/api/auth/callback/credentials` 响应是否包含 `Set-Cookie`

4. **验证 Session**：
   - 访问 `https://你的域名/api/auth/session`
   - 应该返回用户信息而不是 `null`

## 🚀 快速修复命令

如果您有 Cloudflare API 访问权限，可以使用 wrangler 命令：

```bash
# 设置环境变量
echo "AUTH_SECRET=$(openssl rand -hex 32)" > .env.runtime
wrangler pages secret bulk .env.runtime --project-name=你的项目名

# 清理临时文件
rm .env.runtime

# 触发重新部署
wrangler pages deployment create .vercel/output/static --project-name=你的项目名
```

## 📞 如果问题仍然存在

请提供以下信息：
1. Cloudflare Functions 的实时日志截图
2. 浏览器 Network 面板中 `/api/auth/callback/credentials` 的完整响应
3. 您的域名和 Cloudflare Pages 项目名称
4. 是否在 Production 环境还是 Preview 环境测试
