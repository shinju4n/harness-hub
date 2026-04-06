"use client";

import { useEffect, useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";

interface CommandItem { name: string; fileName: string; }

export default function CommandsPage() {
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [selected, setSelected] = useState<{ content: string; name: string } | null>(null);

  useEffect(() => {
    fetch("/api/commands").then((r) => r.json()).then((d) => setCommands(d.items));
  }, []);

  const viewCommand = async (name: string) => {
    const res = await fetch(`/api/commands?name=${name}`);
    if (res.ok) {
      const data = await res.json();
      setSelected({ content: data.content, name });
    }
  };

  if (commands.length === 0) {
    return <div className="text-gray-400">No commands found</div>;
  }

  return (
    <div className="flex gap-6">
      <div className="w-56 shrink-0">
        <h2 className="text-xl font-semibold mb-4">Commands</h2>
        {commands.map((cmd) => (
          <button
            key={cmd.name}
            onClick={() => viewCommand(cmd.name)}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100 ${
              selected?.name === cmd.name ? "bg-gray-100 font-medium" : "text-gray-600"
            }`}
          >
            /{cmd.name}
          </button>
        ))}
      </div>
      <div className="flex-1">
        {selected ? (
          <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} />
        ) : (
          <div className="text-gray-400 text-center mt-20">Select a command to view</div>
        )}
      </div>
    </div>
  );
}
