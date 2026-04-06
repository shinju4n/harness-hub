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
      className="block rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
    >
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
    </Link>
  );
}
