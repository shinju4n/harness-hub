export default function MemoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-6">
        {children}
      </div>
    </div>
  );
}
