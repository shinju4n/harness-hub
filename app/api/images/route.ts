import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readImages, listImageProjects } from "@/lib/images-ops";

export async function GET(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const params = request.nextUrl.searchParams;

    // `?facets=projects` is a "facets only" call. The gallery's primary
    // path uses `?facets=embed` instead, which gets the page entries AND
    // the facet map in a single jsonl walk — see below.
    if (params.get("facets") === "projects") {
      const projects = await listImageProjects(claudeHome);
      return NextResponse.json({ projects });
    }

    const limit = clampInt(params.get("limit"), 60, 1, 500);
    const offset = clampInt(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
    const project = params.get("project") ?? undefined;
    const sinceMs = optionalInt(params.get("since"));
    const untilMs = optionalInt(params.get("until"));
    // When `?facets=embed`, return projects[] alongside entries[] from a
    // single scan. Saves one full jsonl walk on every gallery mount.
    const withFacets = params.get("facets") === "embed";

    const page = await readImages(
      claudeHome,
      { limit, offset, project, sinceMs, untilMs },
      { withFacets }
    );
    return NextResponse.json(page);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function optionalInt(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}
