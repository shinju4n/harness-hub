export default function MemoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 lg:left-60 flex flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-6">
        {children}
      </div>
    </div>
  );
}
