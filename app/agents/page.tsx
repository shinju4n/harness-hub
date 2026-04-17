"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Panel, Group } from "react-resizable-panels";
import { MarkdownViewer } from "@/components/markdown-viewer-dynamic";
import { RefreshButton } from "@/components/refresh-button";
import { EmptyState } from "@/components/empty-state";
import { ResizeHandle } from "@/components/resize-handle";
import { useConfirm } from "@/components/confirm-dialog";
import { VersionHistoryPanel } from "@/components/version-history-panel";
import { DiffModal } from "@/components/diff-modal";
import { usePolling } from "@/lib/use-polling";
import { apiFetch, mutate } from "@/lib/api-client";
import { useToastStore } from "@/stores/toast-store";
import { useVersionHistoryStore } from "@/stores/version-history-store";
import { useVersionDiff } from "@/lib/use-version-diff";

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
  skills?: string[];
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
  const { confirm, dialog: confirmDialog } = useConfirm();
  const pushToast = useToastStore((s) => s.push);

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
    const ok = await confirm({
      title: "Delete agent",
      message: `"${name}" will be removed from ~/.claude/agents/. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await apiFetch(`/api/agents?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (res.ok) {
      pushToast("success", `Agent "${name}" deleted`);
      if (selectedAgent?.name === name) { setSelectedAgent(null); setAgentContent(null); }
      fetchAgents();
    } else {
      const err = await res.json().catch(() => ({}));
      pushToast("error", err.error ?? `Failed to delete "${name}"`);
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
      {confirmDialog}
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
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const pushToast = useToastStore((s) => s.push);
  const { isHistoryOpen, toggleHistory, compareSnapshotId, setCompareSnapshot } = useVersionHistoryStore();
  const diffData = useVersionDiff("agent", selected?.name, rawContent ?? content ?? undefined, compareSnapshotId);
  const [applying, setApplying] = useState(false);

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
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
      />
      <textarea
        placeholder="System prompt (optional)"
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        rows={3}
        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 resize-none"
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
        <EmptyState
          compact
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 8V4H8"/>
              <rect x="8" y="8" width="8" height="8" rx="2"/>
              <path d="M2 12h2"/><path d="M20 12h2"/>
              <path d="M12 2v2"/><path d="M12 20v2"/>
            </svg>
          }
          title="No agents yet"
          description="Drop a markdown file in ~/.claude/agents/ or create one here to get started."
          action={{ label: "Create agent", onClick: () => setCreating(true) }}
        />
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
              aria-label={`Delete agent ${a.name}`}
              className="mt-2 shrink-0 text-xs text-gray-300 dark:text-gray-700 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:text-red-500 transition-colors px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
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
        ) : mobileHistoryOpen ? (
          <div>
            <button
              onClick={() => setMobileHistoryOpen(false)}
              className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              Back to detail
            </button>
            <VersionHistoryPanel kind="agent" name={selected.name} />
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                Back to list
              </button>
              {selected.scope === "user" && (
                <button
                  onClick={() => setMobileHistoryOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  History
                </button>
              )}
            </div>
            <AgentDetail agent={selected} content={content} rawContent={rawContent ?? content} onSave={onSave} />
          </div>
        )}
      </div>

      {/* Desktop: resizable */}
      <div className="hidden lg:block h-[calc(100vh-8rem)]">
        <Group id="agents-panels" orientation="horizontal" defaultLayout={{ list: 28, detail: 72 }}>
          <Panel id="list" minSize="18%" maxSize="50%">
            <div className="h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm overflow-y-auto">
              {agentList}
            </div>
          </Panel>
          <ResizeHandle />
          <Panel id="detail" minSize="40%">
            <div className="h-full overflow-y-auto pr-1">
              {selected && content ? (
                isHistoryOpen ? (
                  <Group id="agents-detail-inner" orientation="horizontal">
                    <Panel id="agents-editor-area" defaultSize={70} minSize={40}>
                      <AgentDetail agent={selected} content={content} rawContent={rawContent ?? content} onSave={onSave} />
                    </Panel>
                    <ResizeHandle />
                    <Panel id="agents-history-area" defaultSize={30} minSize={20}>
                      <VersionHistoryPanel kind="agent" name={selected.name} />
                    </Panel>
                  </Group>
                ) : (
                  <AgentDetail agent={selected} content={content} rawContent={rawContent ?? content} onSave={onSave} historyButton={selected.scope === "user" ? <button onClick={toggleHistory} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors px-2 py-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>History</button> : undefined} />
                )
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  Select an agent to view
                </div>
              )}
            </div>
          </Panel>
        </Group>
      </div>
      <DiffModal
        open={!!diffData}
        oldContents={diffData?.oldContents ?? {}}
        newContents={diffData?.newContents ?? {}}
        oldLabel={diffData?.oldLabel ?? ""}
        newLabel={diffData?.newLabel ?? ""}
        applying={applying}
        onClose={() => setCompareSnapshot(null)}
        onApply={async () => {
          if (!compareSnapshotId || !selected) return;
          setApplying(true);
          try {
            await apiFetch("/api/version-history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "restore", kind: "agent", name: selected.name, snapshotId: compareSnapshotId }),
            });
            setCompareSnapshot(null);
            pushToast("success", "Version restored");
            onSelect(selected);
          } catch {
            pushToast("error", "Failed to restore version");
          } finally {
            setApplying(false);
          }
        }}
      />
    </>
  );
}

function AgentDetail({ agent, content, rawContent, onSave, historyButton }: { agent: AgentDef; content: string; rawContent: string; onSave: (c: string) => Promise<void>; historyButton?: ReactNode }) {
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
          {historyButton && <div className="ml-auto">{historyButton}</div>}
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
        {agent.skills && agent.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mr-1">skills</span>
            {agent.skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 font-mono"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
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
