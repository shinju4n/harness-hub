import { useAppSettingsStore } from "@/stores/app-settings-store";

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
