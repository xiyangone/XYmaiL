import type { NextConfig } from "next";
import withPWA from "next-pwa";
import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";

async function setup() {
  if (process.env.NODE_ENV === "development") {
    await setupDevPlatform();
  }
}

setup();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  // 添加安全头部，可选择性禁用 Cloudflare Insights
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // 可选：禁用 Cloudflare Web Analytics（如果需要）
          // 取消注释下面的行来禁用 Cloudflare Insights
          // {
          //   key: 'CF-Web-Analytics',
          //   value: 'off',
          // },
        ],
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // @ts-expect-error "ignore the error"
})(nextConfig);
