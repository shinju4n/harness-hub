import { NextRequest, NextResponse } from "next/server";
import { getClaudeHomeFromRequest } from "@/lib/claude-home";
import { readPlans, readPlan } from "@/lib/plans-ops";

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
