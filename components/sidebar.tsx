"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "◻" },
  { href: "/plugins", label: "Plugins", icon: "◈" },
  { href: "/skills", label: "Skills", icon: "◇" },
  { href: "/commands", label: "Commands", icon: "▷" },
  { href: "/hooks", label: "Hooks", icon: "↩" },
  { href: "/mcp", label: "MCP", icon: "⊕" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-gray-200 bg-gray-50 p-4 flex flex-col gap-1">
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "bg-white text-gray-900 font-medium shadow-sm"
                : "text-gray-600 hover:bg-white hover:text-gray-900"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
