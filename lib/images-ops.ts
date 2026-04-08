import { createReadStream, existsSync } from "fs";
import { readdir } from "fs/promises";
import { createInterface } from "readline";
import path from "path";

/**
 * Image extraction over Claude Code session JSONL files.
 *
 * Storage model (verified by inspecting `~/.claude/projects/<dir>/<sessionId>.jsonl`):
 *   - Sessions live as JSONL files under `<claudeHome>/projects/<encodedCwd>/`.
 *   - Each line is a record with `type: "user" | "assistant" | ...`. User and
 *     assistant records carry `message.content` either as a plain string or
 *     as an array of Anthropic content blocks.
 *   - Images are inlined as Anthropic-format base64 blocks:
 *     `{ type: "image", source: { type: "base64", media_type: "image/png", data: "..." } }`
 *   - There is no separate `images/` directory — everything is inside the
 *     JSONL stream. Some files run into hundreds of MB so we never load a
 *     whole file into memory; we stream line-by-line and only `JSON.parse`
 *     lines that look like they could contain an image (cheap substring
 *     pre-filter on `"type":"image"`).
 *
 * The list endpoint returns metadata only — never the base64 payload — to
 * keep responses small and let the gallery virtualize. The bytes are fetched
 * on demand per-image via `loadImageBytes`, which decodes a stable opaque id
 * back into (project, file, uuid, blockIndex) and re-streams just enough of
 * the JSONL to find that exact block.
 */

export interface ImageEntry {
  /** Opaque, stable identifier the gallery uses to request the bytes. */
  id: string;
  /** Encoded project directory name as it lives on disk (URL-safe-ish). */
  projectDir: string;
  /** Human-readable project label — falls back to the encoded dir name. */
  projectLabel: string;
  /** Session UUID (basename of the jsonl file without extension). */
  sessionId: string;
  /** The exact basename of the jsonl file we found the image in. */
  fileName: string;
  /** Message UUID inside the jsonl record. */
  messageUuid: string;
  /** 0-based index of this image inside the record's `message.content` array. */
  blockIndex: number;
  /** Epoch ms parsed from the record's `timestamp` ISO string (0 if missing). */
  timestamp: number;
  /** MIME type, e.g. `image/png`. */
  mediaType: string;
  /** Approximate decoded size in bytes (base64 length × 3 / 4). */
  sizeBytes: number;
}

export interface ImageQuery {
  limit: number;
  offset?: number;
  /** Filter by encoded project directory name (matches `ImageEntry.projectDir`). */
  project?: string;
  /** Inclusive lower bound on `timestamp`. */
  sinceMs?: number;
  /** Inclusive upper bound on `timestamp`. */
  untilMs?: number;
}

export interface ImagePage {
  entries: ImageEntry[];
  total: number;
  /**
   * Set to `true` when `readImages` hit the in-memory hard cap and stopped
   * scanning. `total` and any embedded facet counts are then a *lower bound*
   * on the real number of images / per-project counts. The gallery surfaces
   * this so the user knows the view is truncated.
   */
  capped?: boolean;
}

export interface ImageProjectListEntry {
  dir: string;
  label: string;
  /** Lower bound when `ImagePage.capped` is true on the same response. */
  count: number;
}

interface ContentBlock {
  type?: string;
  source?: {
    type?: string;
    media_type?: string;
    data?: string;
  };
}

interface JsonlRecord {
  type?: string;
  uuid?: string;
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
  message?: {
    content?: string | ContentBlock[];
  };
}

/**
 * Decode the project-directory naming convention used by Claude Code:
 * `/Users/me/Documents/wedding` is stored as `-Users-me-Documents-wedding`.
 * The transform is lossy (a real `-` becomes ambiguous) so we never use the
 * decoded form for filesystem access — only as a display label.
 */
function decodeProjectDirLabel(dir: string): string {
  if (!dir.startsWith("-")) return dir;
  return "/" + dir.slice(1).replace(/-/g, "/");
}

function parseIsoMs(value: unknown): number {
  if (typeof value !== "string") return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function approxBase64DecodedSize(b64: string): number {
  // Standard formula, ignoring `=` padding which is at most 2 bytes.
  return Math.floor((b64.length * 3) / 4);
}

const ID_DELIMITER = "\u001f"; // ASCII unit separator — illegal in path components.

function encodeImageId(projectDir: string, fileName: string, messageUuid: string, blockIndex: number): string {
  const raw = [projectDir, fileName, messageUuid, String(blockIndex)].join(ID_DELIMITER);
  return Buffer.from(raw, "utf-8").toString("base64url");
}

interface DecodedImageId {
  projectDir: string;
  fileName: string;
  messageUuid: string;
  blockIndex: number;
}

/**
 * Decode an image id back into its locator. Refuses anything that looks
 * even slightly path-traversal-y so a caller cannot escape the projects
 * directory through a crafted id.
 */
function decodeImageId(id: string): DecodedImageId | null {
  let raw: string;
  try {
    raw = Buffer.from(id, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const parts = raw.split(ID_DELIMITER);
  if (parts.length !== 4) return null;
  const [projectDir, fileName, messageUuid, blockIndexStr] = parts;
  if (!projectDir || !fileName || !messageUuid || !blockIndexStr) return null;
  // No path components, no traversal, no separators.
  if (projectDir.includes("/") || projectDir.includes("\\") || projectDir.includes("..")) return null;
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) return null;
  if (!fileName.endsWith(".jsonl")) return null;
  const blockIndex = Number.parseInt(blockIndexStr, 10);
  if (!Number.isFinite(blockIndex) || blockIndex < 0) return null;
  return { projectDir, fileName, messageUuid, blockIndex };
}

async function* listJsonlFiles(claudeHome: string, projectFilter?: string): AsyncGenerator<{
  projectDir: string;
  filePath: string;
  fileName: string;
}> {
  const projectsRoot = path.join(claudeHome, "projects");
  let projects: string[];
  try {
    projects = await readdir(projectsRoot);
  } catch {
    return;
  }
  for (const projectDir of projects) {
    if (projectDir.startsWith(".")) continue;
    if (projectFilter && projectDir !== projectFilter) continue;
    const projectPath = path.join(projectsRoot, projectDir);
    let files: string[];
    try {
      files = await readdir(projectPath);
    } catch {
      continue;
    }
    for (const fileName of files) {
      if (!fileName.endsWith(".jsonl")) continue;
      yield {
        projectDir,
        fileName,
        filePath: path.join(projectPath, fileName),
      };
    }
  }
}

/**
 * Stream a single jsonl file and yield one ImageEntry per image content
 * block found inside it. Lines that don't contain the substring
 * `"type":"image"` are skipped without parsing — by far the cheapest way to
 * keep the scan tractable on large session files.
 */
async function* extractImagesFromFile(
  filePath: string,
  projectDir: string,
  fileName: string
): AsyncGenerator<ImageEntry> {
  if (!existsSync(filePath)) return;
  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const sessionId = fileName.replace(/\.jsonl$/, "");
  let projectLabelFromCwd: string | null = null;
  try {
    for await (const line of rl) {
      if (!line) continue;
      // Cheap pre-filter: skip lines that obviously can't be image bearers.
      if (line.indexOf('"type":"image"') === -1) {
        // Still try to grab cwd from the very first parseable user/assistant
        // line so the gallery can show a friendly project label later.
        if (!projectLabelFromCwd && line.indexOf('"cwd"') !== -1) {
          try {
            const rec = JSON.parse(line) as JsonlRecord;
            if (typeof rec.cwd === "string" && rec.cwd) projectLabelFromCwd = rec.cwd;
          } catch {
            // ignore — best-effort label only
          }
        }
        continue;
      }
      let rec: JsonlRecord;
      try {
        rec = JSON.parse(line) as JsonlRecord;
      } catch {
        continue;
      }
      if (typeof rec.cwd === "string" && rec.cwd) projectLabelFromCwd = projectLabelFromCwd ?? rec.cwd;

      // `message.content` may legitimately be a plain string (text-only
      // user/assistant messages). Pre-filter false positives — a text block
      // that mentions the literal substring `"type":"image"` — fall through
      // here and we just skip them. Image-bearing records always have
      // content as an array.
      const content = rec.message?.content;
      if (!Array.isArray(content)) continue;
      // Skip records without a stable uuid: `loadImageBytes` matches by
      // uuid, so any image we surface from a uuid-less record would 404
      // when the user clicks it. Better to omit it from the gallery than
      // show a thumbnail that breaks on click.
      const messageUuid = typeof rec.uuid === "string" ? rec.uuid : "";
      if (!messageUuid) continue;
      const ts = parseIsoMs(rec.timestamp);

      for (let idx = 0; idx < content.length; idx += 1) {
        const block = content[idx];
        if (!block || block.type !== "image") continue;
        const src = block.source;
        if (!src || src.type !== "base64") continue;
        const data = src.data;
        if (typeof data !== "string" || !data) continue;
        const mediaType = typeof src.media_type === "string" ? src.media_type : "image/png";
        yield {
          id: encodeImageId(projectDir, fileName, messageUuid, idx),
          projectDir,
          projectLabel: projectLabelFromCwd ?? decodeProjectDirLabel(projectDir),
          sessionId,
          fileName,
          messageUuid,
          blockIndex: idx,
          timestamp: ts,
          mediaType,
          sizeBytes: approxBase64DecodedSize(data),
        };
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
}

/**
 * Hard cap on how many image entries `readImages` keeps in memory before
 * sorting. A pathological session with hundreds of MB of jsonl could in
 * theory yield more entries than this — at which point we stop collecting
 * and return what we have. Tens of thousands fit comfortably in RAM
 * (~200 bytes each); 100k is two orders of magnitude above any realistic
 * single user.
 */
const IMAGE_ENTRY_HARD_CAP = 100_000;

/**
 * Walk every jsonl file under `<claudeHome>/projects/`, extract every image
 * block, sort newest-first, and slice. We deliberately keep this in-memory
 * because the metadata records are tiny (~200 bytes each) — even tens of
 * thousands of images fit comfortably.
 *
 * If the caller passes `withFacets: true`, the function also returns a
 * per-project count map computed during the same walk, so the gallery can
 * populate its filter dropdown without scanning every jsonl twice.
 */
export async function readImages(
  claudeHome: string,
  query: ImageQuery,
  opts: { withFacets?: boolean } = {}
): Promise<ImagePage & { projects?: ImageProjectListEntry[] }> {
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.max(0, query.limit);
  // When the caller only wants facets (limit === 0 with withFacets), there's
  // no point materializing the entries array — we'd just throw it away.
  // Skip the per-entry push in that case so a 50k-image facets-only request
  // doesn't allocate 50k objects for nothing.
  const collectingEntries = limit > 0;
  const collected: ImageEntry[] = [];
  const facets = opts.withFacets ? new Map<string, { label: string; count: number }>() : null;
  let totalSeen = 0;
  let capped = false;

  outer: for await (const file of listJsonlFiles(claudeHome, query.project)) {
    for await (const entry of extractImagesFromFile(file.filePath, file.projectDir, file.fileName)) {
      if (query.sinceMs !== undefined && entry.timestamp < query.sinceMs) continue;
      if (query.untilMs !== undefined && entry.timestamp > query.untilMs) continue;
      totalSeen += 1;
      if (collectingEntries) collected.push(entry);
      if (facets) {
        const existing = facets.get(entry.projectDir);
        if (existing) {
          existing.count += 1;
          if (existing.label.startsWith("-") && !entry.projectLabel.startsWith("-")) {
            existing.label = entry.projectLabel;
          }
        } else {
          facets.set(entry.projectDir, { label: entry.projectLabel, count: 1 });
        }
      }
      if (totalSeen >= IMAGE_ENTRY_HARD_CAP) {
        capped = true;
        break outer;
      }
    }
  }

  collected.sort((a, b) => b.timestamp - a.timestamp);
  const total = totalSeen;
  const entries = collectingEntries ? collected.slice(offset, offset + limit) : [];
  const base: ImagePage = capped ? { entries, total, capped: true } : { entries, total };
  if (!facets) return base;
  const projects = Array.from(facets.entries())
    .map(([dir, v]) => ({ dir, label: v.label, count: v.count }))
    .sort((a, b) => b.count - a.count);
  return { ...base, projects };
}

/**
 * List the distinct projects that contain at least one image, with a count
 * for each. Kept as a separate entry point for callers that only want the
 * facets (e.g. an explicit `?facets=projects` query); for the common case
 * the gallery uses `readImages({ withFacets: true })` to get both in one
 * walk.
 */
export async function listImageProjects(claudeHome: string): Promise<ImageProjectListEntry[]> {
  const result = await readImages(claudeHome, { limit: 0 }, { withFacets: true });
  return result.projects ?? [];
}

/**
 * Re-stream the specific jsonl file referenced by `id` and return the bytes
 * of the requested image block. Returns `null` if the id is malformed, the
 * file is missing, or the block index no longer matches (e.g. the user
 * edited the jsonl out from under us).
 */
export async function loadImageBytes(
  claudeHome: string,
  id: string
): Promise<{ mediaType: string; bytes: Buffer } | null> {
  const decoded = decodeImageId(id);
  if (!decoded) return null;
  const projectsRoot = path.resolve(claudeHome, "projects");
  const filePath = path.resolve(projectsRoot, decoded.projectDir, decoded.fileName);
  // Defense in depth: even though `decodeImageId` blocks `/`, `\`, and `..`
  // substrings, assert the resolved target stays inside `<claudeHome>/projects/`
  // before opening the stream. If `decodeImageId` is ever loosened, this
  // check still keeps `loadImageBytes` from reading arbitrary files.
  const containmentBoundary = projectsRoot + path.sep;
  if (filePath !== projectsRoot && !filePath.startsWith(containmentBoundary)) {
    return null;
  }
  if (!existsSync(filePath)) return null;

  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line || line.indexOf('"type":"image"') === -1) continue;
      let rec: JsonlRecord;
      try {
        rec = JSON.parse(line) as JsonlRecord;
      } catch {
        continue;
      }
      if (typeof rec.uuid !== "string") continue;
      if (rec.uuid !== decoded.messageUuid) continue;
      const content = rec.message?.content;
      if (!Array.isArray(content)) continue;
      const block = content[decoded.blockIndex];
      if (!block || block.type !== "image" || !block.source || block.source.type !== "base64") return null;
      const data = block.source.data;
      if (typeof data !== "string" || !data) return null;
      const mediaType = typeof block.source.media_type === "string" ? block.source.media_type : "image/png";
      return { mediaType, bytes: Buffer.from(data, "base64") };
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  return null;
}
