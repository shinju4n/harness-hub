"use client";

import dynamic from "next/dynamic";

const Sidebar = dynamic(() => import("@/components/sidebar").then((m) => ({ default: m.Sidebar })), {
  ssr: false,
  loading: () => <aside className="hidden lg:block w-60 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" />,
});

export function SidebarWrapper() {
  return <Sidebar />;
}
