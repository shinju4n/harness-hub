"use client";

import { useEffect, useState } from "react";

interface InboxMessage {
  from: string;
  text: string;
  summary?: string;
  timestamp: string;
  read: boolean;
}

interface AgentInfo {
  name: string;
  team: string;
  messages: InboxMessage[];
  unread: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selected, setSelected] = useState<AgentInfo | null>(null);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents));
  }, []);

  const agentList = (
    <div className="space-y-0.5">
      {agents.map((agent) => (
        <button
          key={`${agent.team}/${agent.name}`}
          onClick={() => setSelected(agent)}
          className={`block w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all ${
            selected?.name === agent.name
              ? "bg-amber-50 text-amber-800 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="truncate">{agent.name}</span>
            {agent.unread > 0 && (
              <span className="shrink-0 ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-semibold bg-amber-500 text-white">
                {agent.unread}
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400">{agent.team}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="mb-6 pl-10 lg:pl-0">
        <h2 className="text-xl font-semibold text-gray-900">Agents</h2>
        <p className="mt-1 text-sm text-gray-500">{agents.length} agents across teams</p>
      </div>

      {agents.length === 0 ? (
        <div className="text-gray-400 text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          No agents configured
        </div>
      ) : (
        <>
          {/* Mobile */}
          <div className="lg:hidden">
            {!selected ? (
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                {agentList}
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
                <AgentDetail agent={selected} />
              </div>
            )}
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex gap-6">
            <div className="w-64 shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm self-start sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
              {agentList}
            </div>
            <div className="flex-1 min-w-0">
              {selected ? (
                <AgentDetail agent={selected} />
              ) : (
                <div className="text-gray-400 text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
                  Select an agent to view messages
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AgentDetail({ agent }: { agent: AgentInfo }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{agent.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">Team: {agent.team} &middot; {agent.messages.length} messages</p>
      </div>
      <div className="divide-y divide-gray-50">
        {agent.messages.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No messages</div>
        ) : (
          agent.messages.map((msg, i) => (
            <div key={i} className={`p-4 ${!msg.read ? "bg-amber-50/30" : ""}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-medium text-gray-700">{msg.from}</span>
                <span className="text-[10px] text-gray-400">
                  {new Date(msg.timestamp).toLocaleString()}
                </span>
                {!msg.read && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-700">
                    NEW
                  </span>
                )}
              </div>
              {msg.summary && (
                <p className="text-sm font-medium text-gray-800 mb-1">{msg.summary}</p>
              )}
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
