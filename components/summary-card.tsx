import Link from "next/link";

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  href: string;
}

export function SummaryCard({ title, value, subtitle, href }: SummaryCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-gray-200 bg-white p-5 sm:p-6 transition-all hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400 group-hover:text-gray-500">{title}</p>
      <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
    </Link>
  );
}
