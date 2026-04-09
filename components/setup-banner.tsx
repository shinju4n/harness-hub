"use client";

import { useEffect, useState } from "react";

interface HealthResponse {
  status: string;
  mode: string;
  claudeHome: string | null;
}

export function SetupBanner() {
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json() as Promise<HealthResponse>)
      .then((data) => {
        const problems: string[] = [];
        if (data.mode === "web" && !data.claudeHome) {
          problems.push("CLAUDE_HOME is not set or the directory was not found.");
        }
        setIssues(problems);
      })
      .catch(() => {
        setIssues(["Unable to reach the health endpoint."]);
      });
  }, []);

  if (issues.length === 0) return null;

  return (
    <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <p className="font-medium text-amber-400">Setup issue detected</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}
