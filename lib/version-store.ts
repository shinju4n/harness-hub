import { createHash } from "crypto";
import { readFile, rename, mkdir, stat, open } from "fs/promises";
import path from "path";

// --- writeWithFsync: safe write that file-ops.ts lacks ---
export async function writeWithFsync(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmpPath = filePath + `.tmp.${Date.now()}`;
  const fh = await open(tmpPath, "w");
  try {
    await fh.writeFile(content, "utf-8");
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmpPath, filePath);
}

export function hashContent(content: string): string {
  const digest = createHash("sha256").update(content, "utf-8").digest("hex");
  return `sha256:${digest}`;
}

function objectPath(baseDir: string, hash: string): string {
  const hex = hash.replace("sha256:", "");
  return path.join(baseDir, "objects", hex.slice(0, 2), `${hex.slice(2)}.bin`);
}

export async function putObject(baseDir: string, content: string): Promise<string> {
  const hash = hashContent(content);
  if (await hasObject(baseDir, hash)) return hash;
  await writeWithFsync(objectPath(baseDir, hash), content);
  return hash;
}

export async function getObject(baseDir: string, hash: string): Promise<string> {
  return readFile(objectPath(baseDir, hash), "utf-8");
}

export async function hasObject(baseDir: string, hash: string): Promise<boolean> {
  try {
    await stat(objectPath(baseDir, hash));
    return true;
  } catch {
    return false;
  }
}
