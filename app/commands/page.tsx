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

  const saveCommand = async (content: string) => {
    if (!selected) return;
    await fetch("/api/commands", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, content }),
    });
    setSelected({ ...selected, content });
  };

  const commandList = (
    <div className="space-y-0.5">
      {commands.map((cmd) => (
        <button
          key={cmd.name}
          onClick={() => viewCommand(cmd.name)}
          className={`block w-full text-left px-3 py-2 rounded-lg text-[13px] font-mono transition-all ${
            selected?.name === cmd.name
              ? "bg-indigo-50 text-indigo-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          /{cmd.name}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">Commands</h2>
        <p className="mt-1 text-sm text-gray-500">{commands.length} commands</p>
      </div>

      {commands.length === 0 ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-xl border border-gray-200">No commands found</div>
      ) : (
        <>
          {/* Mobile */}
          <div className="lg:hidden">
            {!selected ? (
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                {commandList}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setSelected(null)}
                  className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                  Back to list
                </button>
                <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={saveCommand} />
              </div>
            )}
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex gap-6">
            <div className="w-56 shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm self-start sticky top-6">
              {commandList}
            </div>
            <div className="flex-1 min-w-0">
              {selected ? (
                <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={saveCommand} />
              ) : (
                <div className="text-gray-400 text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
                  Select a command to view
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
