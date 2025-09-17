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
  // 添加安全头部
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // 可选：禁用 Cloudflare Web Analytics（如果需要）
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
