import { readFile, writeFile, rename, stat, copyFile } from "fs/promises";
import matter from "gray-matter";

interface JsonReadResult<T = unknown> {
  data: T | null;
  error?: string;
  mtime?: number;
}

interface WriteResult {
  success: boolean;
  error?: string;
}

interface MarkdownReadResult {
  data: { frontmatter: Record<string, unknown>; content: string } | null;
  error?: string;
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<JsonReadResult<T>> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const fileStat = await stat(filePath);
    return { data: JSON.parse(raw) as T, mtime: fileStat.mtimeMs };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}

export async function writeJsonFile(
  filePath: string,
  data: unknown,
  expectedMtime: number
): Promise<WriteResult> {
  try {
    const currentStat = await stat(filePath);
    if (Math.abs(currentStat.mtimeMs - expectedMtime) > 100) {
      return { success: false, error: "File conflict: file was modified since last read" };
    }

    const backupPath = filePath.replace(/\.json$/, ".backup.json");
    await copyFile(filePath, backupPath);

    const tmpPath = filePath + ".tmp";
    const json = JSON.stringify(data, null, 2) + "\n";
    JSON.parse(json);
    await writeFile(tmpPath, json, "utf-8");
    await rename(tmpPath, filePath);

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function readMarkdownFile(filePath: string): Promise<MarkdownReadResult> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const { data: frontmatter, content } = matter(raw);
    return { data: { frontmatter, content } };
  } catch (err) {
    return { data: null, error: (err as Error).message };
  }
}
