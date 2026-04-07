export interface MemoryProject {
  id: string;
  path: string;
  memoryCount: number;
  hasMemoryDir: boolean;
}

export interface MemoryFile {
  fileName: string;
  name: string | null;
  description: string | null;
  type: "user" | "feedback" | "project" | "reference" | "unknown";
  body: string;
  mtime: string;
}

export interface MemoryListResult {
  memories: MemoryFile[];
  memoryIndex: string | null;
  warning?: string;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  warning?: string;
}

export interface CreateMemoryInput {
  fileName: string;
  name: string;
  description: string;
  type: "user" | "feedback" | "project" | "reference" | "unknown";
  body: string;
}

export interface UpdateMemoryInput extends CreateMemoryInput {
  expectedMtime: number;
}

export const MEMORY_TYPES = ["user", "feedback", "project", "reference"] as const;

export function buildMemoryFileContent(input: {
  name: string;
  description: string;
  type: string;
  body: string;
}): string {
  return `---\nname: ${input.name}\ndescription: ${input.description}\ntype: ${input.type}\n---\n\n${input.body}\n`;
}
