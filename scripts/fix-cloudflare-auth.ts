/**
 * Cloudflare 生产环境 AUTH_SECRET 修复脚本
 * 自动设置环境变量并重新部署
 */

import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

const PROJECT_NAME = process.env.PROJECT_NAME || 'xymail';

console.log('🔧 Cloudflare 生产环境 AUTH_SECRET 修复工具');
console.log('=====================================\n');

// 检查必要的环境变量
const requiredEnvVars = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ 缺少必要的环境变量:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n请设置这些环境变量后重新运行脚本。');
  process.exit(1);
}

async function fixCloudflareAuth() {
  try {
    // 1. 生成安全的 AUTH_SECRET
    console.log('🔑 生成安全的 AUTH_SECRET...');
    const authSecret = randomBytes(32).toString('hex');
    console.log(`✅ 生成的 AUTH_SECRET 长度: ${authSecret.length} 字符`);

    // 2. 创建临时环境变量文件
    console.log('\n📝 创建临时环境变量文件...');
    const tempEnvFile = '.env.cloudflare-fix';
    const envContent = `AUTH_SECRET=${authSecret}\n`;
    writeFileSync(tempEnvFile, envContent);
    console.log('✅ 临时文件创建成功');

    // 3. 推送环境变量到 Cloudflare Pages
    console.log('\n🚀 推送环境变量到 Cloudflare Pages...');
    try {
      execSync(`npx wrangler pages secret bulk ${tempEnvFile} --project-name=${PROJECT_NAME}`, {
        stdio: 'inherit'
      });
      console.log('✅ 环境变量推送成功');
    } catch (error) {
      console.error('❌ 推送环境变量失败:', error);
      throw error;
    }

    // 4. 清理临时文件
    console.log('\n🧹 清理临时文件...');
    if (existsSync(tempEnvFile)) {
      unlinkSync(tempEnvFile);
      console.log('✅ 临时文件清理完成');
    }

    // 5. 触发重新部署
    console.log('\n🔄 触发重新部署...');
    try {
      // 检查是否有构建输出目录
      if (existsSync('.vercel/output/static')) {
        execSync(`npx wrangler pages deployment create .vercel/output/static --project-name=${PROJECT_NAME}`, {
          stdio: 'inherit'
        });
        console.log('✅ 重新部署成功');
      } else {
        console.log('⚠️ 未找到构建输出目录，请手动重新部署');
        console.log('   可以在 Cloudflare Dashboard 中点击 "Create deployment"');
      }
    } catch (error) {
      console.log('⚠️ 自动部署失败，请手动重新部署');
      console.log('   可以在 Cloudflare Dashboard 中点击 "Create deployment"');
    }

    console.log('\n🎉 修复完成！');
    console.log('\n📋 接下来的步骤:');
    console.log('1. 等待部署完成（约1-2分钟）');
    console.log('2. 使用隐身窗口访问您的网站');
    console.log('3. 测试卡密登录功能');
    console.log('4. 如果仍有问题，请检查 Cloudflare Functions 日志');

  } catch (error) {
    console.error('\n❌ 修复过程中出现错误:', error);
    
    // 清理临时文件
    const tempEnvFile = '.env.cloudflare-fix';
    if (existsSync(tempEnvFile)) {
      unlinkSync(tempEnvFile);
      console.log('🧹 已清理临时文件');
    }
    
    console.log('\n🔧 手动修复步骤:');
    console.log('1. 登录 Cloudflare Dashboard');
    console.log('2. 进入 Pages 项目设置');
    console.log('3. 在 Environment variables 中添加:');
    console.log(`   AUTH_SECRET = ${randomBytes(32).toString('hex')}`);
    console.log('4. 重新部署项目');
    
    process.exit(1);
  }
}

// 运行修复脚本
fixCloudflareAuth();
