export type AppMode = "desktop" | "web";

export function getMode(): AppMode {
  return process.env.HARNESS_HUB_MODE === "web" ? "web" : "desktop";
}

export function isWebMode(): boolean {
  return getMode() === "web";
}
