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
  const headers = {
    ...getApiHeaders(),
    ...(options?.headers as Record<string, string> | undefined),
  };
  return fetch(url, { ...options, headers });
}
