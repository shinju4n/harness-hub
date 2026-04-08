"use client";

import { useState } from "react";
import { Panel, Group } from "react-resizable-panels";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState } from "@/components/empty-state";
import { ResizeHandle } from "@/components/resize-handle";
import { useConfirm } from "@/components/confirm-dialog";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";

interface CommandItem { name: string; fileName: string; }

export default function CommandsPage() {
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [selected, setSelected] = useState<{ content: string; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const pushToast = useToastStore((s) => s.push);

  const fetchCommands = () => {
    apiFetch("/api/commands").then((r) => r.json()).then((d) => setCommands(d.items));
  };

  const { refresh } = usePolling(fetchCommands);

  const viewCommand = async (name: string) => {
    const res = await apiFetch(`/api/commands?name=${name}`);
    if (res.ok) {
      const data = await res.json();
      setSelected({ content: data.content, name });
    }
  };

  const saveCommand = async (content: string) => {
    if (!selected) return;
    await apiFetch("/api/commands", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, content }),
    });
    setSelected({ ...selected, content });
  };

  const createCommand = async () => {
    if (!newName.trim()) return;
    const res = await apiFetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), content: newContent }),
    });
    if (res.ok) {
      setCreating(false);
      setNewName("");
      setNewContent("");
      fetchCommands();
    }
  };

  const deleteCommand = async (name: string) => {
    const ok = await confirm({
      title: "Delete command",
      message: `"/${name}" will be removed from ~/.claude/commands/. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await apiFetch(`/api/commands?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      pushToast("success", `Command "/${name}" deleted`);
      if (selected?.name === name) setSelected(null);
      fetchCommands();
    } else {
      const err = await res.json().catch(() => ({}));
      pushToast("error", err.error ?? `Failed to delete "/${name}"`);
    }
  };

  const commandList = (
    <div className="space-y-0.5">
      {commands.map((cmd) => (
        <div key={cmd.name} className="flex items-center gap-1 group">
          <button
            onClick={() => viewCommand(cmd.name)}
            className={`flex-1 text-left px-3 py-2 rounded-lg text-[13px] font-mono transition-all ${
              selected?.name === cmd.name
                ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            /{cmd.name}
          </button>
          <button
            onClick={() => deleteCommand(cmd.name)}
            aria-label={`Delete command /${cmd.name}`}
            className="shrink-0 text-xs text-gray-300 dark:text-gray-700 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:text-red-500 transition-colors px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );

  const createForm = creating ? (
    <div className="mt-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
      <input
        type="text"
        placeholder="command-name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full text-[13px] font-mono px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
      />
      <textarea
        placeholder="Content (optional)"
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        rows={3}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 resize-none"
      />
      <div className="flex gap-1.5">
        <button
          onClick={createCommand}
          className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { setCreating(false); setNewName(""); setNewContent(""); }}
          className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setCreating(true)}
      className="mt-3 w-full text-[13px] border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg py-1.5 transition-colors"
    >
      + New Command
    </button>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Commands</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{commands.length} commands</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {commands.length === 0 && !creating ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <EmptyState
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            }
            title="No slash commands yet"
            description="Create reusable prompts you can run with /name from inside Claude Code."
            action={{ label: "Create command", onClick: () => setCreating(true) }}
          />
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="lg:hidden">
            {!selected ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
                {commandList}
                {createForm}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setSelected(null)}
                  className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                  Back to list
                </button>
                <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={saveCommand} />
              </div>
            )}
          </div>

          {/* Desktop: resizable */}
          <div className="hidden lg:block h-[calc(100vh-8rem)]">
            <Group id="commands-panels" orientation="horizontal" defaultLayout={{ list: 28, detail: 72 }}>
              <Panel id="list" minSize="18%" maxSize="50%">
                <div className="h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm overflow-y-auto">
                  {commandList}
                  {createForm}
                </div>
              </Panel>
              <ResizeHandle />
              <Panel id="detail" minSize="40%">
                <div className="h-full overflow-y-auto pr-1">
                  {selected ? (
                    <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={saveCommand} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                      Select a command to view
                    </div>
                  )}
                </div>
              </Panel>
            </Group>
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  );
}
