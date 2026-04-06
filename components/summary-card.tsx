import Link from "next/link";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  href: string;
  icon: React.ReactNode;
  color?: string;
}

const colorStyles: Record<string, { bg: string; icon: string; ring: string }> = {
  amber: { bg: "bg-amber-50", icon: "text-amber-500", ring: "group-hover:ring-amber-200" },
  blue: { bg: "bg-blue-50", icon: "text-blue-500", ring: "group-hover:ring-blue-200" },
  green: { bg: "bg-green-50", icon: "text-green-500", ring: "group-hover:ring-green-200" },
  purple: { bg: "bg-purple-50", icon: "text-purple-500", ring: "group-hover:ring-purple-200" },
  rose: { bg: "bg-rose-50", icon: "text-rose-500", ring: "group-hover:ring-rose-200" },
  cyan: { bg: "bg-cyan-50", icon: "text-cyan-500", ring: "group-hover:ring-cyan-200" },
  orange: { bg: "bg-orange-50", icon: "text-orange-500", ring: "group-hover:ring-orange-200" },
  gray: { bg: "bg-gray-100", icon: "text-gray-500", ring: "group-hover:ring-gray-200" },
};

export function SummaryCard({ title, value, subtitle, href, icon, color = "amber" }: SummaryCardProps) {
  const c = colorStyles[color] ?? colorStyles.amber;

  return (
    <Link
      href={href}
      className={`group block rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ring-1 ring-transparent ${c.ring}`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${c.bg}`}>
          <span className={c.icon}>{icon}</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-gray-400 transition-colors mt-1">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{value}</p>
        <p className="mt-1 text-sm font-medium text-gray-500">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
    </Link>
  );
}
