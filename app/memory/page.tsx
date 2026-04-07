"use client";

import { useState, useCallback } from "react";
import { RefreshButton } from "@/components/refresh-button";
import { usePolling } from "@/lib/use-polling";
import { apiFetch } from "@/lib/api-client";
import type { MemoryProject, MemoryFile } from "@/lib/memory-ops";
import { ProjectList } from "./_components/ProjectList";
import { MemoryList } from "./_components/MemoryList";
import { MemoryEditor } from "./_components/MemoryEditor";
import { CreateMemoryModal } from "./_components/CreateMemoryModal";

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
        // Re-fetch the selected memory to get updated mtime
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

  // Mobile step navigation
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
    <div>
      {/* Header */}
      <div className="mb-6 pl-10 lg:pl-0 flex items-start justify-between">
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
        <div className="mb-4 px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-sm">
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
      <div className="lg:hidden">
        {mobileStep === 1 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm">
            <ProjectList projects={projects} selectedId={null} onSelect={handleSelectProject} />
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

      {/* Desktop layout */}
      <div className="hidden lg:flex gap-6">
        {/* Project list */}
        <div className="w-64 shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm self-start sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <ProjectList
            projects={projects}
            selectedId={selectedProject?.id ?? null}
            onSelect={handleSelectProject}
          />
        </div>

        {/* Memory list */}
        <div className="w-56 shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-sm self-start sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
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

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {selectedMemory ? (
            <MemoryEditor memory={selectedMemory} onSave={handleSave} onDelete={handleDelete} />
          ) : (
            <div className="text-gray-400 dark:text-gray-500 text-center py-20 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              {selectedProject ? "Select a memory to view" : "Select a project to begin"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
