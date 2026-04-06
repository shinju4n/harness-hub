import { NextRequest, NextResponse } from "next/server";
import { getClaudeHome } from "@/lib/claude-home";
import { readMarkdownFile } from "@/lib/file-ops";
import { readdir } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const name = request.nextUrl.searchParams.get("name");

  if (name) {
    const result = await readMarkdownFile(path.join(claudeHome, "commands", `${name}.md`));
    if (result.data) {
      return NextResponse.json({ content: result.data.content, frontmatter: result.data.frontmatter });
    }
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }

  const dir = path.join(claudeHome, "commands");
  try {
    const files = await readdir(dir);
    const commands = files.filter((f: string) => f.endsWith(".md")).map((f: string) => ({
      name: f.replace(".md", ""),
      fileName: f,
    }));
    return NextResponse.json({ items: commands });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
