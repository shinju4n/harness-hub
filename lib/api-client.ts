import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useToastStore } from "@/stores/toast-store";

export function getApiHeaders(): Record<string, string> {
  const { profiles, activeProfileId } = useAppSettingsStore.getState();
  const profile = profiles.find((p) => p.id === activeProfileId);
  const headers: Record<string, string> = {};

  if (profile && profile.homePath !== "auto") {
    headers["x-claude-home"] = profile.homePath;
  }

  if (activeProfileId) {
    headers["x-profile-id"] = activeProfileId;
  }

  const userDataPath = (globalThis as Record<string, unknown>).__harnessHubUserDataPath;
  if (typeof userDataPath === "string" && userDataPath) {
    headers["x-user-data-path"] = userDataPath;
  }

  return headers;
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const profileHeaders = getApiHeaders();
  const merged = new Headers(options?.headers);
  for (const [key, value] of Object.entries(profileHeaders)) {
    if (!merged.has(key)) merged.set(key, value);
  }
  return fetch(url, { ...options, headers: merged });
}

export async function mutate(
  url: string,
  init: RequestInit,
  opts: { success?: string; errorPrefix?: string } = {}
): Promise<Response> {
  const { push } = useToastStore.getState();
  try {
    const res = await apiFetch(url, init);
    if (res.ok) {
      if (opts.success) push("success", opts.success);
    } else {
      const message = await res.text().catch(() => "Unknown error");
      const prefix = opts.errorPrefix ?? "Error";
      push("error", `${prefix}: ${message}`);
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const prefix = opts.errorPrefix ?? "Error";
    push("error", `${prefix}: ${message}`);
    throw err;
  }
}
