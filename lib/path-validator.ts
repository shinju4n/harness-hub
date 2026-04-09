const WINDOWS_RESERVED = new Set([
  "con", "prn", "aux", "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

export function isSafeSegment(segment: string): boolean {
  if (!segment || segment !== segment.trim()) return false;
  if (segment.includes("\x00")) return false;
  if (segment.includes("/") || segment.includes("\\") || segment.includes("..")) return false;
  if (/^\.+$/.test(segment)) return false;
  if (WINDOWS_RESERVED.has(segment.toLowerCase())) return false;
  return true;
}
