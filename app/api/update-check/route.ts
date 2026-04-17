import { NextRequest, NextResponse } from "next/server";

import packageJson from "@/package.json";
import { requireAuth } from "@/lib/auth";
import { isNewer } from "@/lib/semver";

const REPO = "shinju4n/harness-hub";
const CURRENT_VERSION = packageJson.version;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult) return authResult;

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github.v3+json" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
        updateAvailable: false,
        error: "Failed to check for updates",
      });
    }

    const data = await res.json();
    const latestVersion = (data.tag_name as string)?.replace(/^v/, "") ?? CURRENT_VERSION;

    return NextResponse.json({
      currentVersion: CURRENT_VERSION,
      latestVersion,
      updateAvailable: isNewer(latestVersion, CURRENT_VERSION),
      releaseUrl: data.html_url,
      releaseNotes: data.body,
      publishedAt: data.published_at,
    });
  } catch {
    return NextResponse.json({
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      updateAvailable: false,
      error: "Network error",
    });
  }
}
