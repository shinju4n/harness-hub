import { NextRequest, NextResponse } from "next/server";
import { getClaudeHome } from "@/lib/claude-home";
import {
  listMemoryProjects,
  listMemoryFiles,
  readMemoryFile,
  createMemoryFile,
  updateMemoryFile,
  deleteMemoryFile,
} from "@/lib/memory-ops";

// ─── Validation ───

function hasTraversal(value: string): boolean {
  return value.includes("..");
}

function hasPathSeparator(value: string): boolean {
  return value.includes("/") || value.includes("\\");
}

function validateProjectId(projectId: string): string | null {
  if (hasTraversal(projectId)) return "Invalid project id";
  return null;
}

function validateFileName(fileName: string): string | null {
  if (hasTraversal(fileName) || hasPathSeparator(fileName))
    return "Invalid file name";
  return null;
}

// ─── GET ───

export async function GET(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const params = request.nextUrl.searchParams;

  // ?list=projects → list all projects
  if (params.get("list") === "projects") {
    const projects = await listMemoryProjects(claudeHome);
    return NextResponse.json({ projects });
  }

  const projectId = params.get("project");
  if (!projectId) {
    return NextResponse.json(
      { error: "Missing required parameter: project or list=projects" },
      { status: 400 }
    );
  }

  const projErr = validateProjectId(projectId);
  if (projErr) return NextResponse.json({ error: projErr }, { status: 400 });

  const fileName = params.get("file");

  // ?project={id}&file={name} → single file
  if (fileName) {
    const fileErr = validateFileName(fileName);
    if (fileErr)
      return NextResponse.json({ error: fileErr }, { status: 400 });

    const memory = await readMemoryFile(claudeHome, projectId, fileName);
    if (!memory) {
      return NextResponse.json(
        { error: "Memory file not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(memory);
  }

  // ?project={id} → list memories for project
  const result = await listMemoryFiles(claudeHome, projectId);
  return NextResponse.json(result);
}

// ─── POST ───

export async function POST(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const body = await request.json();
  const { project, fileName, name, description, type, body: content } = body;

  if (!project || !fileName) {
    return NextResponse.json(
      { error: "project and fileName are required" },
      { status: 400 }
    );
  }

  const projErr = validateProjectId(project);
  if (projErr) return NextResponse.json({ error: projErr }, { status: 400 });
  const fileErr = validateFileName(fileName);
  if (fileErr) return NextResponse.json({ error: fileErr }, { status: 400 });

  const result = await createMemoryFile(claudeHome, project, {
    fileName,
    name,
    description,
    type,
    body: content,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result);
}

// ─── PUT ───

export async function PUT(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const body = await request.json();
  const {
    project,
    fileName,
    name,
    description,
    type,
    body: content,
    mtime,
  } = body;

  if (!project || !fileName) {
    return NextResponse.json(
      { error: "project and fileName are required" },
      { status: 400 }
    );
  }

  const projErr = validateProjectId(project);
  if (projErr) return NextResponse.json({ error: projErr }, { status: 400 });
  const fileErr = validateFileName(fileName);
  if (fileErr) return NextResponse.json({ error: fileErr }, { status: 400 });

  const result = await updateMemoryFile(claudeHome, project, {
    fileName,
    name,
    description,
    type,
    body: content,
    expectedMtime: mtime,
  });

  if (!result.success) {
    const status = result.error?.includes("conflict") ? 409 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}

// ─── DELETE ───

export async function DELETE(request: NextRequest) {
  const claudeHome = getClaudeHome();
  const params = request.nextUrl.searchParams;

  const projectId = params.get("project");
  const fileName = params.get("file");

  if (!projectId || !fileName) {
    return NextResponse.json(
      { error: "project and file are required" },
      { status: 400 }
    );
  }

  const projErr = validateProjectId(projectId);
  if (projErr) return NextResponse.json({ error: projErr }, { status: 400 });
  const fileErr = validateFileName(fileName);
  if (fileErr) return NextResponse.json({ error: fileErr }, { status: 400 });

  const result = await deleteMemoryFile(claudeHome, projectId, fileName);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result);
}
