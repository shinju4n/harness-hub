import { readdir, stat, readFile, writeFile, mkdir, lstat, unlink } from "fs/promises";
import path from "path";

export type HookLanguage = "javascript" | "typescript" | "python" | "shell";

export interface HookFileSummary {
  name: string;
  language: HookLanguage;
  size: number;
  mtime: number;
}

export interface HookFileDetail extends HookFileSummary {
  content: string;
}

const EXTENSION_TO_LANGUAGE: Record<string, HookLanguage> = {
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".js": "javascript",
  ".ts": "typescript",
  ".py": "python",
  ".sh": "shell",
};

const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_LANGUAGE);

function hooksDir(claudeHome: string): string {
  return path.join(claudeHome, "hooks");
}

function languageFor(name: string): HookLanguage | null {
  const ext = path.extname(name).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}

/**
 * Whitelist: dotfiles, path separators, parent traversal, and any extension
 * not in SUPPORTED_EXTENSIONS are rejected. The base name itself must contain
 * only file-safe characters.
 */
function isSafeHookFileName(name: string): boolean {
  if (!name || name.length > 255) return false;
  if (name.startsWith(".")) return false;
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return false;
  if (name.includes("\u0000")) return false;
  if (!languageFor(name)) return false;
  return /^[A-Za-z0-9._-]+$/.test(name);
}

function assertSafeName(name: string): void {
  if (!isSafeHookFileName(name)) {
    throw new Error(`Invalid hook file name: ${name}`);
  }
}

async function refuseSymlink(filePath: string): Promise<void> {
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) {
      throw new Error(`Refusing to operate on symlink: ${filePath}`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export async function listHookFiles(claudeHome: string): Promise<HookFileSummary[]> {
  const dir = hooksDir(claudeHome);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const candidates = entries.filter((name) => {
    if (name.startsWith(".")) return false;
    return languageFor(name) !== null;
  });

  const summaries = await Promise.all(
    candidates.map(async (name): Promise<HookFileSummary | null> => {
      try {
        const fileStat = await stat(path.join(dir, name));
        if (!fileStat.isFile()) return null;
        return {
          name,
          language: languageFor(name)!,
          size: fileStat.size,
          mtime: fileStat.mtimeMs,
        };
      } catch {
        return null;
      }
    })
  );

  return summaries
    .filter((s): s is HookFileSummary => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function readHookFile(
  claudeHome: string,
  name: string
): Promise<HookFileDetail | null> {
  assertSafeName(name);
  const filePath = path.join(hooksDir(claudeHome), name);
  try {
    const [content, fileStat] = await Promise.all([
      readFile(filePath, "utf-8"),
      stat(filePath),
    ]);
    return {
      name,
      content,
      language: languageFor(name)!,
      size: fileStat.size,
      mtime: fileStat.mtimeMs,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeHookFile(
  claudeHome: string,
  name: string,
  content: string
): Promise<void> {
  assertSafeName(name);
  const dir = hooksDir(claudeHome);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  await refuseSymlink(filePath);
  await writeFile(filePath, content, "utf-8");
}

export async function createHookFile(
  claudeHome: string,
  name: string,
  content: string
): Promise<void> {
  assertSafeName(name);
  const dir = hooksDir(claudeHome);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  try {
    await writeFile(filePath, content, { encoding: "utf-8", flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Hook script already exists: ${name}`);
    }
    throw err;
  }
}

export async function deleteHookFile(claudeHome: string, name: string): Promise<boolean> {
  assertSafeName(name);
  const filePath = path.join(hooksDir(claudeHome), name);
  await refuseSymlink(filePath);
  try {
    await unlink(filePath);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

export { SUPPORTED_EXTENSIONS };
