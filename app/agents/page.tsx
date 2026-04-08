"use client";

import { useEffect, useState } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch, mutate } from "@/lib/api-client";

type Tab = "definitions" | "teams";

interface AgentDef {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  memory?: string;
  color?: string;
  effort?: string;
  background?: boolean;
  body: string;
  scope: "user" | "project";
}

interface InboxMessage {
  from: string;
  text: string;
  summary?: string;
  timestamp: string;
  read: boolean;
}

interface TeamAgent {
  name: string;
  team: string;
  messages: InboxMessage[];
  unread: number;
}

const colorMap: Record<string, string> = {
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
  pink: "bg-pink-100 text-pink-700",
  cyan: "bg-cyan-100 text-cyan-700",
};

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>("definitions");
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [teams, setTeams] = useState<TeamAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamAgent | null>(null);
  const [agentContent, setAgentContent] = useState<string | null>(null);
  const [agentRawContent, setAgentRawContent] = useState<string | null>(null);

  const fetchAgents = () => {
    apiFetch("/api/agents?tab=definitions").then((r) => r.json()).then((d) => setAgents(d.agents));
  };

  const { refresh } = usePolling(fetchAgents);

  useEffect(() => {
    apiFetch("/api/agents?tab=teams").then((r) => r.json()).then((d) => setTeams(d.teams));
  }, []);

  const viewAgent = async (agent: AgentDef) => {
    setSelectedAgent(agent);
    const res = await apiFetch(`/api/agents?tab=definitions&name=${agent.name}`);
    if (res.ok) {
      const data = await res.json();
      setAgentContent(data.content);
      setAgentRawContent(data.rawContent ?? data.content);
    }
  };

  const saveAgent = async (content: string) => {
    if (!selectedAgent) return;
    const res = await mutate(
      "/api/agents",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedAgent.name, content }),
      },
      { success: `Agent "${selectedAgent.name}" saved`, errorPrefix: "Save failed" }
    );
    if (res.ok && selectedAgent) {
      setAgentRawContent(content);
      // Parse the new frontmatter body for display (content after frontmatter)
      const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
      setAgentContent(fmMatch ? fmMatch[1] : content);
    }
  };

  const createAgent = async (name: string, content: string) => {
    const res = await mutate(
      "/api/agents",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
      },
      { success: `Agent "${name}" created`, errorPrefix: "Create failed" }
    );
    if (res.ok) fetchAgents();
    return res.ok;
  };

  const deleteAgent = async (name: string) => {
    if (!window.confirm(`Delete agent "${name}"?`)) return;
    const res = await apiFetch(`/api/agents?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedAgent?.name === name) { setSelectedAgent(null); setAgentContent(null); }
      fetchAgents();
    }
  };

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Agents</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {agents.length} definitions, {teams.length} team inboxes
          </p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 w-fit mb-6">
        <button
          onClick={() => setTab("definitions")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "definitions" ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm font-medium" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Definitions
        </button>
        <button
          onClick={() => setTab("teams")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all ${
            tab === "teams" ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm font-medium" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Team Inboxes
          {teams.reduce((acc, t) => acc + t.unread, 0) > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold bg-amber-500 text-white">
              {teams.reduce((acc, t) => acc + t.unread, 0)}
            </span>
          )}
        </button>
      </div>

      {tab === "definitions" && (
        <DefinitionsTab
          agents={agents}
          selected={selectedAgent}
          content={agentContent}
          rawContent={agentRawContent}
          onSelect={viewAgent}
          onBack={() => { setSelectedAgent(null); setAgentContent(null); setAgentRawContent(null); }}
          onSave={saveAgent}
          onCreate={createAgent}
          onDelete={deleteAgent}
        />
      )}
      {tab === "teams" && <TeamsTab teams={teams} selected={selectedTeam} onSelect={setSelectedTeam} />}
    </div>
  );
}

function DefinitionsTab({ agents, selected, content, rawContent, onSelect, onBack, onSave, onCreate, onDelete }: {
  agents: AgentDef[];
  selected: AgentDef | null;
  content: string | null;
  rawContent: string | null;
  onSelect: (a: AgentDef) => void;
  onBack: () => void;
  onSave: (content: string) => Promise<void>;
  onCreate: (name: string, content: string) => Promise<boolean>;
  onDelete: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ok = await onCreate(newName.trim(), newContent);
    if (ok) { setCreating(false); setNewName(""); setNewContent(""); }
  };

  const createForm = creating ? (
    <div className="mt-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50/50 dark:bg-amber-950/50 space-y-2">
      <input
        type="text"
        placeholder="agent-name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400"
      />
      <textarea
        placeholder="System prompt (optional)"
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        rows={3}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-400 resize-none"
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleCreate}
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
      + New Agent
    </button>
  );

  const agentList = (
    <div className="space-y-0.5">
      {agents.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">No agent definitions found in ~/.claude/agents/</p>
      ) : (
        agents.map((a) => (
          <div key={a.name} className="flex items-start gap-1 group">
            <button
              onClick={() => onSelect(a)}
              className={`flex-1 text-left px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                selected?.name === a.name
                  ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {a.color && (
                  <span className={`shrink-0 w-2 h-2 rounded-full ${colorMap[a.color]?.split(" ")[0] ?? "bg-gray-300"}`} />
                )}
                <span className="truncate">{a.name}</span>
              </div>
              {a.description && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{a.description}</p>
              )}
            </button>
            <button
              onClick={() => onDelete(a.name)}
              className="mt-2 shrink-0 text-xs text-gray-300 dark:text-gray-700 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 focus-visible:text-red-500 transition-all px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        ))
      )}
      {createForm}
    </div>
  );

  return (
    <>
      {/* Mobile */}
      <div className="lg:hidden">
        {!selected || !content ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            {agentList}
          </div>
        ) : (
          <div>
            <button
              onClick={onBack}
              className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              Back to list
            </button>
            <AgentDetail agent={selected} content={content} rawContent={rawContent ?? content} onSave={onSave} />
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex gap-6">
        <div className="w-64 shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm self-start sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {agentList}
        </div>
        <div className="flex-1 min-w-0">
          {selected && content ? (
            <AgentDetail agent={selected} content={content} rawContent={rawContent ?? content} onSave={onSave} />
          ) : (
            <div className="text-gray-400 dark:text-gray-500 text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              Select an agent to view
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AgentDetail({ agent, content, rawContent, onSave }: { agent: AgentDef; content: string; rawContent: string; onSave: (c: string) => Promise<void> }) {
  return (
    <div className="space-y-4">
      {/* Meta card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{agent.name}</h3>
          {agent.color && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colorMap[agent.color] ?? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
              {agent.color}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {agent.scope}
          </span>
        </div>
        {agent.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{agent.description}</p>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          {agent.model && (
            <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              model: <span className="font-mono">{agent.model}</span>
            </span>
          )}
          {agent.memory && (
            <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              memory: <span className="font-mono">{agent.memory}</span>
            </span>
          )}
          {agent.effort && (
            <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              effort: <span className="font-mono">{agent.effort}</span>
            </span>
          )}
          {agent.background && (
            <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">background</span>
          )}
          {agent.tools && agent.tools.length > 0 && (
            <span className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              tools: <span className="font-mono">{Array.isArray(agent.tools) ? agent.tools.join(", ") : agent.tools}</span>
            </span>
          )}
        </div>
      </div>

      {/* System prompt — edit mode shows full raw file (frontmatter + body) */}
      <MarkdownViewer content={content} rawContent={rawContent} fileName={`${agent.name}.md`} onSave={onSave} />
    </div>
  );
}

function TeamsTab({ teams, selected, onSelect }: {
  teams: TeamAgent[];
  selected: TeamAgent | null;
  onSelect: (t: TeamAgent | null) => void;
}) {
  if (teams.length === 0) {
    return (
      <div className="text-gray-400 dark:text-gray-500 text-center py-12 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        No team inboxes found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {teams.map((t) => (
        <div key={`${t.team}/${t.name}`} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <button
            onClick={() => onSelect(selected?.name === t.name ? null : t)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="text-left">
              <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{t.name}</span>
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{t.team}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">{t.messages.length} messages</span>
              {t.unread > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-semibold bg-amber-500 text-white">
                  {t.unread}
                </span>
              )}
            </div>
          </button>
          {selected?.name === t.name && (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {t.messages.map((msg, i) => (
                <div key={i} className={`p-4 ${!msg.read ? "bg-amber-50/30 dark:bg-amber-950/20" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{msg.from}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(msg.timestamp).toLocaleString()}</span>
                    {!msg.read && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">NEW</span>
                    )}
                  </div>
                  {msg.summary && <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">{msg.summary}</p>}
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
