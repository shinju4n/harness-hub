import { NextRequest, NextResponse } from "next/server";
import { getClaudeHome } from "@/lib/claude-home";
import { readMarkdownFile } from "@/lib/file-ops";
import { readdir, writeFile } from "fs/promises";
import path from "path";

interface RuleFile {
  name: string;
  fileName: string;
}

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const name = request.nextUrl.searchParams.get("name");

  if (name) {
    const result = await readMarkdownFile(path.join(claudeHome, "rules", `${name}.md`));
    if (result.data) {
      return NextResponse.json({ content: result.data.content, frontmatter: result.data.frontmatter });
    }
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const rulesDir = path.join(claudeHome, "rules");
  try {
    const files = await readdir(rulesDir);
    const rules: RuleFile[] = files
      .filter((f: string) => f.endsWith(".md"))
      .map((f: string) => ({ name: f.replace(".md", ""), fileName: f }));
    return NextResponse.json({ items: rules });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const { name, content } = await request.json();

  if (!name || typeof content !== "string") {
    return NextResponse.json({ error: "name and content required" }, { status: 400 });
  }

  const filePath = path.join(claudeHome, "rules", `${name}.md`);
  try {
    await writeFile(filePath, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
