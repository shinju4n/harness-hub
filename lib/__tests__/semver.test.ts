import { describe, it, expect } from "vitest";
import { compareVersions, isNewer } from "../semver";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("treats a leading v as equivalent", () => {
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
  });

  it("orders by major first", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.9.9", "2.0.0")).toBe(-1);
  });

  it("orders by minor when major matches", () => {
    expect(compareVersions("1.3.0", "1.2.9")).toBe(1);
    expect(compareVersions("1.2.0", "1.3.0")).toBe(-1);
  });

  it("orders by patch when major+minor match", () => {
    expect(compareVersions("1.2.4", "1.2.3")).toBe(1);
  });

  it("treats a release as newer than its prerelease", () => {
    expect(compareVersions("1.2.3", "1.2.3-beta")).toBe(1);
    expect(compareVersions("1.2.3-beta", "1.2.3")).toBe(-1);
  });

  it("returns 0 for unparseable input (graceful no-op)", () => {
    expect(compareVersions("garbage", "1.2.3")).toBe(0);
  });
});

describe("isNewer", () => {
  it("is true when latest > current", () => {
    expect(isNewer("1.3.0", "1.2.0")).toBe(true);
  });

  it("is false when latest === current (no spurious update banner)", () => {
    expect(isNewer("1.2.0", "1.2.0")).toBe(false);
  });

  it("is false when running a DEV build ahead of the latest GitHub release", () => {
    // Previously the API used string equality, which would have flagged a
    // local 1.4.0 against GitHub's 1.3.0 as "update available" — wrong.
    expect(isNewer("1.3.0", "1.4.0")).toBe(false);
  });
});
