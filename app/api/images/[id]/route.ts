import { NextRequest } from "next/server";
import { getClaudeHome, getClaudeHomeFromRequest } from "@/lib/claude-home";
import { loadImageBytes } from "@/lib/images-ops";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    // <img> tags can't send custom headers, so the gallery page may pass
    // the active profile's home path as a `?home=` query param. We funnel
    // it through `getClaudeHome` (same hygiene checks as the header path).
    // Header still wins when both are present so non-img callers stay
    // header-only.
    const headerHome = request.headers.get("x-claude-home");
    const queryHome = request.nextUrl.searchParams.get("home");
    const claudeHome = headerHome
      ? getClaudeHomeFromRequest(request)
      : queryHome
        ? getClaudeHome(queryHome)
        : getClaudeHome();
    const result = await loadImageBytes(claudeHome, id);
    if (!result) {
      return new Response("Image not found", { status: 404 });
    }
    // Return raw bytes so the gallery can drop the URL straight into <img>.
    // The id is a stable hash of (project, file, uuid, blockIndex), so the
    // bytes are immutable for the lifetime of that record — cache aggressively.
    const body = new Uint8Array(result.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": result.mediaType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, max-age=3600",
        // Defense in depth: if a record's media_type is wrong/spoofed
        // (e.g. an HTML payload masquerading as image/png), prevent the
        // browser from MIME-sniffing and rendering it as HTML.
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return new Response((err as Error).message, { status: 500 });
  }
}
