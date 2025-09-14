"use client";

import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-px">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-primary"
          >
            {/* 夕阳背景圆形 */}
            <circle
              cx="16"
              cy="16"
              r="12"
              className="fill-gradient-to-br from-orange-400 to-red-500"
              fill="url(#sunsetGradient)"
            />

            {/* 夕阳渐变定义 */}
            <defs>
              <linearGradient
                id="sunsetGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#FF6B35" />
                <stop offset="50%" stopColor="#F7931E" />
                <stop offset="100%" stopColor="#FF4500" />
              </linearGradient>
            </defs>

            {/* 信封轮廓 */}
            <path
              d="M6 10h20v12H6V10z"
              className="fill-white/90 stroke-white stroke-1"
            />

            {/* 信封折线 */}
            <path
              d="M6 10l10 6 10-6"
              className="stroke-orange-600 stroke-2"
              fill="none"
            />

            {/* @ 符号 */}
            <path
              d="M13 14h6v4h-6v-4zM11 16h2v4h-2v-4zM19 16h2v4h-2v-4zM13 20h6v1h-6v-1z"
              className="fill-orange-600"
            />

            {/* 夕阳光芒装饰 */}
            <path
              d="M16 2v4M16 26v4M2 16h4M26 16h4M6.34 6.34l2.83 2.83M22.83 22.83l2.83 2.83M6.34 25.66l2.83-2.83M22.83 9.17l2.83-2.83"
              className="stroke-orange-400 stroke-1"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <span className="font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-600">
        XiYang
      </span>
    </Link>
  );
}
