import { useAppSettingsStore } from "@/stores/app-settings-store";
import { useToastStore } from "@/stores/toast-store";

export function getApiHeaders(): Record<string, string> {
  const { profiles, activeProfileId } = useAppSettingsStore.getState();
  const profile = profiles.find((p) => p.id === activeProfileId);
  if (profile && profile.homePath !== "auto") {
    return { "x-claude-home": profile.homePath };
  }
  return {};
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
