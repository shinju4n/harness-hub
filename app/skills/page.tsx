"use client";

import { useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";

interface SkillItem {
  name: string;
  source: "plugin" | "custom";
  pluginName?: string;
  marketplace?: string;
}

interface SelectedSkill {
  content: string;
  name: string;
  source: "plugin" | "custom";
  pluginName?: string;
  marketplace?: string;
}

const skillKey = (s: { name: string; source: string; pluginName?: string; marketplace?: string }) =>
  `${s.source}/${s.marketplace ?? ""}/${s.pluginName ?? ""}/${s.name}`;

export default function SkillsPage() {
  const [skills, setSkills] = useState<{ items: SkillItem[] } | null>(null);
  const [selected, setSelected] = useState<SelectedSkill | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

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
        name: skill.name,
        source: skill.source,
        pluginName: skill.pluginName,
        marketplace: skill.marketplace,
      });
    }
  };

  const saveSkill = async (content: string) => {
    if (!selected || selected.source !== "custom") return;
    await apiFetch("/api/skills", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, content }),
    });
    setSelected({ ...selected, content });
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
    if (!window.confirm(`Delete skill "${name}"?`)) return;
    const res = await apiFetch(`/api/skills?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      if (selected?.name === name) setSelected(null);
      fetchSkills();
    }
  };

  if (!skills) return <div className="text-gray-400 dark:text-gray-500 pt-12 text-center">Loading...</div>;

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
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
      />
      <textarea
        placeholder="Content (optional)"
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        rows={3}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400 resize-none"
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
              className="opacity-0 group-hover:opacity-100 shrink-0 text-xs text-red-400 hover:text-red-600 transition-all px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
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
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            {skillList}
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
            {breadcrumb}
            <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={selected.source === "custom" ? saveSkill : undefined} />
          </div>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden lg:flex gap-6">
        <div className="w-64 shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm self-start sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {skillList}
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              {breadcrumb}
              <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={selected.source === "custom" ? saveSkill : undefined} />
            </>
          ) : (
            <div className="text-gray-400 dark:text-gray-500 text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              Select a skill to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
