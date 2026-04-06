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
  const [selected, setSelected] = useState<{ content: string; name: string } | null>(null);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then(setSkills);
  }, []);

  const viewSkill = async (skill: SkillItem) => {
    const params = new URLSearchParams({ name: skill.name, source: skill.source });
    if (skill.pluginName) params.set("plugin", skill.pluginName);
    const res = await fetch(`/api/skills?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSelected({ content: data.content, name: skill.name });
    }
  };

  if (!skills) return <div className="text-gray-400">Loading...</div>;

  const pluginSkills = skills.items.filter((s) => s.source === "plugin");
  const customSkills = skills.items.filter((s) => s.source === "custom");

  const grouped = pluginSkills.reduce<Record<string, SkillItem[]>>((acc, s) => {
    const key = s.pluginName ?? "unknown";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0">
        <h2 className="text-xl font-semibold mb-4">Skills</h2>
        {customSkills.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">Custom</h3>
            {customSkills.map((s) => (
              <button
                key={s.name}
                onClick={() => viewSkill(s)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100 ${
                  selected?.name === s.name ? "bg-gray-100 font-medium" : "text-gray-600"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        {Object.entries(grouped).map(([plugin, items]) => (
          <div key={plugin} className="mb-4">
            <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">{plugin}</h3>
            {items.map((s) => (
              <button
                key={s.name}
                onClick={() => viewSkill(s)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100 ${
                  selected?.name === s.name ? "bg-gray-100 font-medium" : "text-gray-600"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1">
        {selected ? (
          <MarkdownViewer content={selected.content} fileName={`${selected.name}.md`} />
        ) : (
          <div className="text-gray-400 text-center mt-20">Select a skill to view</div>
        )}
      </div>
    </div>
  );
}
