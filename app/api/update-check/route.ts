import { NextResponse } from "next/server";

const REPO = "shinju4n/harness-hub";
const CURRENT_VERSION = "0.2.0";

export async function GET() {
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
    const updateAvailable = latestVersion !== CURRENT_VERSION;

    return NextResponse.json({
      currentVersion: CURRENT_VERSION,
      latestVersion,
      updateAvailable,
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
