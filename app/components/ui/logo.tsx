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
            <circle cx="16" cy="16" r="12" fill="url(#sunsetGradient)" />

            {/* 渐变定义 */}
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
              <linearGradient
                id="catGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#F0F0F0" />
              </linearGradient>
            </defs>

            {/* 三花猫头部 */}
            <ellipse
              cx="16"
              cy="14"
              rx="8"
              ry="7"
              fill="url(#catGradient)"
              stroke="#FF6B35"
              strokeWidth="0.5"
            />

            {/* 猫耳朵 */}
            <path
              d="M10 9 L12 6 L14 8 Z"
              fill="url(#catGradient)"
              stroke="#FF6B35"
              strokeWidth="0.3"
            />
            <path
              d="M18 8 L20 6 L22 9 Z"
              fill="url(#catGradient)"
              stroke="#FF6B35"
              strokeWidth="0.3"
            />

            {/* 三花猫花纹 */}
            <ellipse
              cx="12"
              cy="12"
              rx="2"
              ry="1.5"
              fill="#FF8C42"
              opacity="0.8"
            />
            <ellipse
              cx="19"
              cy="13"
              rx="2.5"
              ry="1.8"
              fill="#FF8C42"
              opacity="0.8"
            />
            <ellipse
              cx="20"
              cy="10"
              rx="1.5"
              ry="1.2"
              fill="#2C2C2C"
              opacity="0.7"
            />
            <ellipse
              cx="11"
              cy="16"
              rx="1.2"
              ry="1"
              fill="#2C2C2C"
              opacity="0.7"
            />

            {/* 猫眼睛 */}
            <ellipse cx="13" cy="13" rx="1" ry="1.5" fill="#4A90E2" />
            <ellipse cx="19" cy="13" rx="1" ry="1.5" fill="#4A90E2" />
            <ellipse cx="13" cy="13" rx="0.4" ry="1" fill="#000000" />
            <ellipse cx="19" cy="13" rx="0.4" ry="1" fill="#000000" />

            {/* 猫鼻子和嘴巴 */}
            <path d="M16 15 L15 16 L17 16 Z" fill="#FF69B4" />
            <path
              d="M16 16 Q14 18 12 17"
              stroke="#FF6B35"
              strokeWidth="0.5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M16 16 Q18 18 20 17"
              stroke="#FF6B35"
              strokeWidth="0.5"
              fill="none"
              strokeLinecap="round"
            />

            {/* 小信封装饰 */}
            <rect
              x="13"
              y="22"
              width="6"
              height="4"
              rx="0.5"
              fill="url(#catGradient)"
              stroke="#FF6B35"
              strokeWidth="0.3"
            />
            <path
              d="M13 22 L16 24 L19 22"
              stroke="#FF4500"
              strokeWidth="0.5"
              fill="none"
              strokeLinecap="round"
            />
            <circle
              cx="16"
              cy="24"
              r="1"
              fill="none"
              stroke="#FF4500"
              strokeWidth="0.3"
            />
            <circle cx="16" cy="24" r="0.5" fill="#FF4500" />
          </svg>
        </div>
      </div>
      <span className="font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-600">
        XiYang
      </span>
    </Link>
  );
}
