"use client";

import { useState, useCallback } from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";
import type { MemoryProject, MemoryFile } from "@/lib/memory-ops";
import { ProjectList } from "./_components/ProjectList";
import { MemoryList } from "./_components/MemoryList";
import { MemoryEditor } from "./_components/MemoryEditor";
import { CreateMemoryModal } from "./_components/CreateMemoryModal";

function ResizeHandle() {
  return (
    <Separator className="group w-2 flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors rounded">
      <div className="w-0.5 h-8 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-amber-400 dark:group-hover:bg-amber-500 transition-colors" />
    </Separator>
  );
}

export default function MemoryPage() {
  const [projects, setProjects] = useState<MemoryProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<MemoryProject | null>(null);
  const [memories, setMemories] = useState<MemoryFile[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<MemoryFile | null>(null);
  const [creating, setCreating] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const fetchProjects = useCallback(() => {
    apiFetch("/api/memory?list=projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
  }, []);

  const { refresh } = usePolling(fetchProjects);

  const fetchMemories = useCallback(
    async (projectId: string) => {
      const res = await apiFetch(`/api/memory?project=${encodeURIComponent(projectId)}`);
      const data = await res.json();
      setMemories(data.memories ?? []);
      if (data.warning) setWarning(data.warning);
    },
    []
  );

  const handleSelectProject = useCallback(
    async (project: MemoryProject) => {
      setSelectedProject(project);
      setSelectedMemory(null);
      setCreating(false);
      setWarning(null);
      await fetchMemories(project.id);
    },
    [fetchMemories]
  );

  const handleSelectMemory = useCallback(
    async (memory: MemoryFile) => {
      if (!selectedProject) return;
      const res = await apiFetch(
        `/api/memory?project=${encodeURIComponent(selectedProject.id)}&file=${encodeURIComponent(memory.fileName)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedMemory(data);
      }
    },
    [selectedProject]
  );

  const handleSave = useCallback(
    async (data: { name: string; description: string; type: string; body: string; mtime: string }) => {
      if (!selectedProject || !selectedMemory) return;
      const res = await apiFetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: selectedProject.id,
          fileName: selectedMemory.fileName,
          name: data.name,
          description: data.description,
          type: data.type,
          body: data.body,
          mtime: new Date(data.mtime).getTime(),
        }),
      });
      if (res.ok) {
        await fetchMemories(selectedProject.id);
        const refreshRes = await apiFetch(
          `/api/memory?project=${encodeURIComponent(selectedProject.id)}&file=${encodeURIComponent(selectedMemory.fileName)}`
        );
        if (refreshRes.ok) setSelectedMemory(await refreshRes.json());
      } else {
        const err = await res.json();
        setWarning(err.error ?? "Save failed");
      }
    },
    [selectedProject, selectedMemory, fetchMemories]
  );

  const handleDelete = useCallback(
    async (fileName: string) => {
      if (!selectedProject) return;
      if (!window.confirm(`Delete "${fileName}"?`)) return;
      const res = await apiFetch(
        `/api/memory?project=${encodeURIComponent(selectedProject.id)}&file=${encodeURIComponent(fileName)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setSelectedMemory(null);
        await fetchMemories(selectedProject.id);
        fetchProjects();
      }
    },
    [selectedProject, fetchMemories, fetchProjects]
  );

  const handleCreate = useCallback(
    async (data: { fileName: string; name: string; description: string; type: string; body: string }): Promise<boolean> => {
      if (!selectedProject) return false;
      const res = await apiFetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: selectedProject.id, ...data }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.warning) setWarning(result.warning);
        setCreating(false);
        await fetchMemories(selectedProject.id);
        fetchProjects();
        return true;
      }
      return false;
    },
    [selectedProject, fetchMemories, fetchProjects]
  );

  const totalMemories = projects.reduce((acc, p) => acc + p.memoryCount, 0);

  const mobileStep = selectedMemory ? 3 : selectedProject ? 2 : 1;

  const backArrow = (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );

  const newMemoryButton = selectedProject && !creating ? (
    <button
      onClick={() => setCreating(true)}
      className="mt-3 w-full text-[13px] border border-dashed border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg py-1.5 transition-colors"
    >
      + New Memory
    </button>
  ) : null;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      {/* Header */}
      <div className="mb-6 pl-10 lg:pl-4 pr-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Memory</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {projects.length} projects, {totalMemories} memories
          </p>
        </div>
        <RefreshButton onRefresh={refresh} />
      </div>

      {/* Warning banner */}
      {warning && (
        <div className="mx-4 mb-4 px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-sm">
          {warning}
          <button
            onClick={() => setWarning(null)}
            className="ml-2 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mobile layout */}
      <div className="lg:hidden px-4">
        {mobileStep === 1 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            <ProjectList projects={projects} selectedId={selectedProject?.id ?? null} onSelect={handleSelectProject} />
          </div>
        )}

        {mobileStep === 2 && (
          <div>
            <button
              onClick={() => { setSelectedProject(null); setMemories([]); setCreating(false); }}
              className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {backArrow}
              Back to projects
            </button>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
              <MemoryList memories={memories} selectedFile={null} onSelect={handleSelectMemory} />
              {newMemoryButton}
              {creating && (
                <CreateMemoryModal onSubmit={handleCreate} onClose={() => setCreating(false)} />
              )}
            </div>
          </div>
        )}

        {mobileStep === 3 && selectedMemory && (
          <div>
            <button
              onClick={() => setSelectedMemory(null)}
              className="mb-3 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {backArrow}
              Back to memories
            </button>
            <MemoryEditor memory={selectedMemory} onSave={handleSave} onDelete={handleDelete} />
          </div>
        )}
      </div>

      {/* Desktop layout — resizable panels */}
      <div className="hidden lg:block h-[calc(100vh-10rem)] px-2">
        <Group id="memory-panels" orientation="horizontal" defaultLayout={{ projects: 25, memories: 20, editor: 55 }}>
          {/* Project list panel */}
          <Panel id="projects" minSize="15%" maxSize="40%">
            <div className="h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm overflow-y-auto">
              <ProjectList
                projects={projects}
                selectedId={selectedProject?.id ?? null}
                onSelect={handleSelectProject}
              />
            </div>
          </Panel>

          <ResizeHandle />

          {/* Memory list panel */}
          <Panel id="memories" minSize="12%" maxSize="35%">
            <div className="h-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm overflow-y-auto">
              {selectedProject ? (
                <>
                  <MemoryList
                    memories={memories}
                    selectedFile={selectedMemory?.fileName ?? null}
                    onSelect={handleSelectMemory}
                  />
                  {newMemoryButton}
                  {creating && (
                    <CreateMemoryModal onSubmit={handleCreate} onClose={() => setCreating(false)} />
                  )}
                </>
              ) : (
                <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  Select a project
                </p>
              )}
            </div>
          </Panel>

          <ResizeHandle />

          {/* Editor panel */}
          <Panel id="editor" minSize="30%">
            <div className="h-full overflow-y-auto">
              {selectedMemory ? (
                <MemoryEditor memory={selectedMemory} onSave={handleSave} onDelete={handleDelete} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  {selectedProject ? "Select a memory to view" : "Select a project to begin"}
                </div>
              )}
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}
