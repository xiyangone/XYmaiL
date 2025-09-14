"use client";

import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <div className="relative w-8 h-8">
        <img
          src="/icons/svg/sanhuamao-logo.svg"
          alt="XiYang Logo"
          width={32}
          height={32}
          className="w-full h-full object-contain"
        />
      </div>
      <span className="font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-600">
        XiYang
      </span>
    </Link>
  );
}
