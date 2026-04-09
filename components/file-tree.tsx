"use client";

import { useState } from "react";

export interface FileTreeNode {
  name: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedFile?: string | null;
  onSelect: (filePath: string) => void;
  onDelete?: (filePath: string) => void;
  onAdd?: () => void;
  /** Label shown above the tree */
  label?: string;
  /** If true, show an empty state when no nodes */
  emptyText?: string;
}

export function FileTree({ nodes, selectedFile, onSelect, onDelete, onAdd, label, emptyText }: FileTreeProps) {
  if (nodes.length === 0 && !onAdd) {
    return emptyText ? (
      <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-3">{emptyText}</p>
    ) : null;
  }

  return (
    <div className="text-[13px]">
      {label && (
        <div className="flex items-center justify-between mb-1.5 px-1">
          <h4 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</h4>
          {onAdd && (
            <button
              onClick={onAdd}
              className="text-[10px] text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              aria-label="Add file"
            >
              + Add
            </button>
          )}
        </div>
      )}
      {nodes.length === 0 && emptyText && (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-2">{emptyText}</p>
      )}
      <div className="space-y-px">
        {nodes.map((node) => (
          <TreeNode
            key={node.name}
            node={node}
            depth={0}
            prefix=""
            selectedFile={selectedFile}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  prefix,
  selectedFile,
  onSelect,
  onDelete,
}: {
  node: FileTreeNode;
  depth: number;
  prefix: string;
  selectedFile?: string | null;
  onSelect: (filePath: string) => void;
  onDelete?: (filePath: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const filePath = prefix ? `${prefix}/${node.name}` : node.name;
  const isSelected = selectedFile === filePath;

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {/* Folder icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-amber-500 dark:text-amber-400"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.name}
                node={child}
                depth={depth + 1}
                prefix={filePath}
                selectedFile={selectedFile}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center group">
      <button
        onClick={() => onSelect(filePath)}
        className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors ${
          isSelected
            ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
        style={{ paddingLeft: `${depth * 12 + 20}px` }}
      >
        {/* File icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="truncate">{node.name}</span>
      </button>
      {onDelete && (
        <button
          onClick={() => onDelete(filePath)}
          aria-label={`Delete ${node.name}`}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 text-[10px] text-red-400 hover:text-red-600 transition-colors px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950"
        >
          Del
        </button>
      )}
    </div>
  );
}
