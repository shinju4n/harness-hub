import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import {
  readPlans,
  readPlan,
  writePlan,
  createPlan,
  deletePlan,
} from "@/lib/plans-ops";

export async function GET(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const name = request.nextUrl.searchParams.get("name");

    if (name) {
      try {
        const plan = await readPlan(claudeHome, name);
        if (!plan) {
          return NextResponse.json({ error: "Plan not found" }, { status: 404 });
        }
        return NextResponse.json(plan);
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
      }
    }

    const plans = await readPlans(claudeHome);
    return NextResponse.json({ plans, total: plans.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const { name, content } = await request.json();
    if (typeof name !== "string" || typeof content !== "string") {
      return NextResponse.json({ error: "name and content required" }, { status: 400 });
    }
    await createPlan(claudeHome, name, content);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = (err as Error).message;
    const status = /already exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const { name, content } = await request.json();
    if (typeof name !== "string" || typeof content !== "string") {
      return NextResponse.json({ error: "name and content required" }, { status: 400 });
    }
    await writePlan(claudeHome, name, content);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const claudeHome = getClaudeHomeFromRequest(request);
    const name = request.nextUrl.searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const ok = await deletePlan(claudeHome, name);
    if (!ok) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
