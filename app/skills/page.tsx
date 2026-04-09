"use client";

import { useState, useEffect } from "react";
import { Panel, Group } from "react-resizable-panels";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { RefreshButton } from "@/components/refresh-button";
import { ListSkeleton } from "@/components/loading-skeleton";
import { ResizeHandle } from "@/components/resize-handle";
import { useConfirm } from "@/components/confirm-dialog";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";
import { VersionHistoryPanel } from "@/components/version-history-panel";
import { VersionDiffView } from "@/components/version-diff-view";
import { ExternalEditBanner } from "@/components/external-edit-banner";
import { TrashSection } from "@/components/trash-section";
import { useVersionHistoryStore } from "@/stores/version-history-store";

interface SkillItem {
  name: string;
  source: "plugin" | "custom";
  pluginName?: string;
  marketplace?: string;
}

interface SelectedSkill {
  content: string;
  rawContent: string;
  name: string;
  source: "plugin" | "custom";
  pluginName?: string;
  marketplace?: string;
  currentSource?: string;
}

const skillKey = (s: { name: string; source: string; pluginName?: string; marketplace?: string }) =>
  `${s.source}/${s.marketplace ?? ""}/${s.pluginName ?? ""}/${s.name}`;

export default function SkillsPage() {
  const [skills, setSkills] = useState<{ items: SkillItem[] } | null>(null);
  const [selected, setSelected] = useState<SelectedSkill | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [mobileView, setMobileView] = useState<"detail" | "history">("detail");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const pushToast = useToastStore((s) => s.push);
  const { isHistoryOpen, toggleHistory, compareSnapshotId, setCompareSnapshot, selectedSnapshotId } = useVersionHistoryStore();
  const [diffData, setDiffData] = useState<{ oldContents: Record<string, string>; newContents: Record<string, string>; oldLabel: string; newLabel: string } | null>(null);

  // Fetch diff data when compareSnapshotId changes
  useEffect(() => {
    if (!compareSnapshotId || !selected) {
      setDiffData(null);
      return;
    }
    let cancelled = false;
    async function loadDiff() {
      try {
        // Fetch the selected snapshot contents
        const res = await apiFetch(
          `/api/version-history?action=get&kind=skill&name=${encodeURIComponent(selected!.name)}&id=${encodeURIComponent(compareSnapshotId!)}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();

        // "Old" = snapshot, "New" = current on-disk content
        const oldContents = data.contents as Record<string, string>;
        const newContents: Record<string, string> = {};
        // Use rawContent as the current version for the primary file
        const primaryFile = Object.keys(oldContents)[0] ?? "SKILL.md";
        newContents[primaryFile] = selected!.rawContent;

        if (!cancelled) {
          setDiffData({
            oldContents,
            newContents,
            oldLabel: `v${data.snapshot.id.slice(0, 8)} · ${new Date(data.snapshot.createdAt).toLocaleString()}`,
            newLabel: "Current",
          });
        }
      } catch {
        if (!cancelled) setDiffData(null);
      }
    }
    loadDiff();
    return () => { cancelled = true; };
  }, [compareSnapshotId, selected]);

  const fetchSkills = () => {
    apiFetch("/api/skills").then((r) => r.json()).then(setSkills);
  };

  const { refresh } = usePolling(fetchSkills);

  const viewSkill = async (skill: SkillItem) => {
    const params = new URLSearchParams({ name: skill.name, source: skill.source });
    if (skill.pluginName) params.set("plugin", skill.pluginName);
    if (skill.marketplace) params.set("marketplace", skill.marketplace);
    const res = await apiFetch(`/api/skills?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSelected({
        content: data.content,
        rawContent: data.rawContent ?? data.content,
        name: skill.name,
        source: skill.source,
        pluginName: skill.pluginName,
        marketplace: skill.marketplace,
        currentSource: data.currentSource,
      });
      setMobileView("detail");
    }
  };

  const saveSkill = async (content: string) => {
    if (!selected || selected.source !== "custom") return;
    await apiFetch("/api/skills", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, content }),
    });
    setSelected({ ...selected, content, rawContent: content });
  };

  const createSkill = async () => {
    if (!newName.trim()) return;
    const res = await apiFetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), content: newContent }),
    });
    if (res.ok) {
      setCreating(false);
      setNewName("");
      setNewContent("");
      fetchSkills();
    }
  };

  const deleteSkill = async (name: string) => {
    const ok = await confirm({
      title: "Delete skill",
      message: `"${name}" will be removed from ~/.claude/skills/. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await apiFetch(`/api/skills?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      pushToast("success", `Skill "${name}" deleted`);
      if (selected?.name === name) setSelected(null);
      fetchSkills();
    } else {
      const err = await res.json().catch(() => ({}));
      pushToast("error", err.error ?? `Failed to delete "${name}"`);
    }
  };

  if (!skills) return <div className="pt-4"><ListSkeleton rows={6} /></div>;

  const pluginSkills = skills.items.filter((s) => s.source === "plugin");
  const customSkills = skills.items.filter((s) => s.source === "custom");

  const breadcrumb = selected && selected.source === "plugin" && selected.marketplace ? (
    <div className="mb-2 text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
      <span>{selected.marketplace}</span>
      {selected.pluginName && (
        <>
          <span className="text-gray-300 dark:text-gray-600">›</span>
          <span>{selected.pluginName}</span>
        </>
      )}
      <span className="text-gray-300 dark:text-gray-600">›</span>
      <span className="text-gray-700 dark:text-gray-300">{selected.name}</span>
    </div>
  ) : null;

  const grouped = pluginSkills.reduce<Record<string, SkillItem[]>>((acc, s) => {
    const key = s.marketplace ?? "unknown";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  const sortedMarketplaces = Object.keys(grouped).sort();

  const createForm = creating ? (
    <div className="mt-2 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
      <input
        type="text"
        placeholder="skill-name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
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
          onClick={createSkill}
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
      className="mt-2 w-full text-[13px] border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg py-1.5 transition-colors"
    >
      + New Skill
    </button>
  );

  const skillList = (
    <div className="space-y-1">
      <div className="mb-3">
        <h3 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 px-3">Custom</h3>
        {customSkills.map((s) => (
          <div key={s.name} className="flex items-center gap-1 group">
            <button
              onClick={() => viewSkill(s)}
              className={`flex-1 text-left px-3 py-2 rounded-lg text-[13px] transition-all ${
                selected?.name === s.name
                  ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {s.name}
            </button>
            <button
              onClick={() => deleteSkill(s.name)}
              aria-label={`Delete skill ${s.name}`}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 text-xs text-red-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        ))}
        {createForm}
      </div>
      {sortedMarketplaces.map((marketplace) => (
        <div key={marketplace} className="mb-3">
          <h3 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 px-3">{marketplace}</h3>
          {grouped[marketplace].map((s) => {
            const key = skillKey(s);
            const isSelected = selected ? skillKey(selected) === key : false;
            return (
              <button
                key={key}
                onClick={() => viewSkill(s)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all ${
                  isSelected
                    ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const showExternalBanner = selected && (selected.currentSource === "external" || selected.currentSource === "claude-hook");

  const detailHeader = selected && (
    <div className="flex items-center justify-between mb-2">
      <div className="flex-1">{breadcrumb}</div>
      {selected.source === "custom" && (
        <button
          onClick={toggleHistory}
          aria-label={isHistoryOpen ? "Close version history" : "Open version history"}
          className={`p-1.5 rounded-md transition-colors ${
            isHistoryOpen
              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          {/* Clock/history icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Skills</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{skills.items.length} total</p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {/* Mobile: stacked layout */}
      <div className="lg:hidden">
        {!selected ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
              {skillList}
            </div>
            <TrashSection
              items={[]}
              onRestore={() => {}}
              onPermanentDelete={() => {}}
            />
          </div>
        ) : mobileView === "history" && selected.source === "custom" ? (
          <div>
            <button
              onClick={() => setMobileView("detail")}
              className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              Back to detail
            </button>
            <VersionHistoryPanel kind="skill" name={selected.name} />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setSelected(null)}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                Back to list
              </button>
              {selected.source === "custom" && (
                <button
                  onClick={() => setMobileView("history")}
                  aria-label="View version history"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  History
                </button>
              )}
            </div>
            {showExternalBanner && (
              <div className="mb-3">
                <ExternalEditBanner
                  source={selected.currentSource!}
                  timestamp={Date.now()}
                  onViewChanges={() => {}}
                  onRevert={() => {}}
                />
              </div>
            )}
            {breadcrumb}
            <MarkdownViewer content={selected.content} rawContent={selected.rawContent} fileName={`${selected.name}.md`} onSave={selected.source === "custom" ? saveSkill : undefined} />
          </div>
        )}
      </div>

      {/* Desktop: resizable side-by-side */}
      <div className="hidden lg:block h-[calc(100vh-8rem)]">
        <Group id="skills-panels" orientation="horizontal" defaultLayout={{ list: 28, detail: 72 }}>
          <Panel id="list" minSize="18%" maxSize="50%">
            <div className="h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm overflow-y-auto flex flex-col gap-3">
              {skillList}
              <TrashSection
                items={[]}
                onRestore={() => {}}
                onPermanentDelete={() => {}}
              />
            </div>
          </Panel>
          <ResizeHandle />
          <Panel id="detail" minSize="40%">
            <div className="h-full overflow-y-auto pr-1">
              {selected ? (
                <>
                  {detailHeader}
                  {isHistoryOpen && selected.source === "custom" ? (
                    <Group id="detail-history-panels" orientation="horizontal" defaultLayout={{ editor: 70, history: 30 }} className="h-[calc(100%-2rem)]">
                      <Panel id="editor" minSize="40%">
                        <div className="h-full overflow-y-auto">
                          {showExternalBanner && (
                            <div className="mb-3">
                              <ExternalEditBanner
                                source={selected.currentSource!}
                                timestamp={Date.now()}
                                onViewChanges={() => {}}
                                onRevert={() => {}}
                              />
                            </div>
                          )}
                          {diffData ? (
                            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Comparing versions</span>
                                <button
                                  onClick={() => setCompareSnapshot(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                  Close diff
                                </button>
                              </div>
                              <VersionDiffView {...diffData} />
                            </div>
                          ) : (
                            <MarkdownViewer content={selected.content} rawContent={selected.rawContent} fileName={`${selected.name}.md`} onSave={saveSkill} />
                          )}
                        </div>
                      </Panel>
                      <ResizeHandle />
                      <Panel id="history" minSize="20%">
                        <VersionHistoryPanel kind="skill" name={selected.name} />
                      </Panel>
                    </Group>
                  ) : (
                    <>
                      {showExternalBanner && (
                        <div className="mb-3">
                          <ExternalEditBanner
                            source={selected.currentSource!}
                            timestamp={Date.now()}
                            onViewChanges={() => {}}
                            onRevert={() => {}}
                          />
                        </div>
                      )}
                      <MarkdownViewer content={selected.content} rawContent={selected.rawContent} fileName={`${selected.name}.md`} onSave={selected.source === "custom" ? saveSkill : undefined} />
                    </>
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  Select a skill to view
                </div>
              )}
            </div>
          </Panel>
        </Group>
      </div>
      {confirmDialog}
    </div>
  );
}
