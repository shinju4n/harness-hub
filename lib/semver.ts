const normalize = (v: string): string => v.trim().replace(/^v/i, "");

const parse = (v: string): [number, number, number, string] | null => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+](.+))?$/.exec(normalize(v));
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ?? ""];
};

export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return (pa[i] as number) < (pb[i] as number) ? -1 : 1;
  }
  const preA = pa[3];
  const preB = pb[3];
  if (preA === preB) return 0;
  if (preA === "") return 1;
  if (preB === "") return -1;
  return preA < preB ? -1 : 1;
}

export function isNewer(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}
