"use client";

import { useEffect, useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";

interface SkillItem {
  name: string;
  source: "plugin" | "custom";
  pluginName?: string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<{ items: SkillItem[] } | null>(null);
  const [selected, setSelected] = useState<{ content: string; name: string; source: "plugin" | "custom" } | null>(null);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then(setSkills);
  }, []);

  const viewSkill = async (skill: SkillItem) => {
    const params = new URLSearchParams({ name: skill.name, source: skill.source });
    if (skill.pluginName) params.set("plugin", skill.pluginName);
    const res = await fetch(`/api/skills?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSelected({ content: data.content, name: skill.name, source: skill.source });
    }
  };

  const saveSkill = async (content: string) => {
    if (!selected || selected.source !== "custom") return;
    await fetch("/api/skills", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, content }),
    });
    setSelected({ ...selected, content });
  };

  if (!skills) return <div className="text-gray-400 pt-12 text-center">Loading...</div>;

  const pluginSkills = skills.items.filter((s) => s.source === "plugin");
  const customSkills = skills.items.filter((s) => s.source === "custom");

  const grouped = pluginSkills.reduce<Record<string, SkillItem[]>>((acc, s) => {
    const key = s.pluginName ?? "unknown";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  const skillList = (
    <div className="space-y-1">
      {customSkills.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 px-3">Custom</h3>
          {customSkills.map((s) => (
            <button
              key={s.name}
              onClick={() => viewSkill(s)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all ${
                selected?.name === s.name
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {Object.entries(grouped).map(([plugin, items]) => (
        <div key={plugin} className="mb-3">
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 px-3">{plugin}</h3>
          {items.map((s) => (
            <button
              key={s.name}
              onClick={() => viewSkill(s)}
              className={`block w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all ${
                selected?.name === s.name
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">Skills</h2>
        <p className="mt-1 text-sm text-gray-500">{skills.items.length} total</p>
      </div>

      {/* Mobile: stacked layout */}
      <div className="lg:hidden">
        {!selected ? (
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            {skillList}
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
            <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={selected.source === "custom" ? saveSkill : undefined} />
          </div>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden lg:flex gap-6">
        <div className="w-64 shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm self-start sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {skillList}
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} onSave={selected.source === "custom" ? saveSkill : undefined} />
          ) : (
            <div className="text-gray-400 text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
              Select a skill to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
