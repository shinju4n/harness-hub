import { describe, it, expect } from "vitest";
import { isSafeSegment } from "../path-validator";

describe("isSafeSegment", () => {
  it("accepts normal names", () => {
    expect(isSafeSegment("my-skill")).toBe(true);
    expect(isSafeSegment("agent_v2")).toBe(true);
    expect(isSafeSegment("日本語")).toBe(true);
  });

  it("rejects traversal", () => {
    expect(isSafeSegment("..")).toBe(false);
    expect(isSafeSegment("foo/bar")).toBe(false);
    expect(isSafeSegment("foo\\bar")).toBe(false);
  });

  it("rejects empty and dots-only", () => {
    expect(isSafeSegment("")).toBe(false);
    expect(isSafeSegment(".")).toBe(false);
    expect(isSafeSegment("...")).toBe(false);
  });

  it("rejects NUL byte", () => {
    expect(isSafeSegment("foo\x00bar")).toBe(false);
  });

  it("rejects leading/trailing whitespace", () => {
    expect(isSafeSegment(" foo")).toBe(false);
    expect(isSafeSegment("foo ")).toBe(false);
  });

  it("rejects Windows reserved names", () => {
    expect(isSafeSegment("CON")).toBe(false);
    expect(isSafeSegment("con")).toBe(false);
    expect(isSafeSegment("PRN")).toBe(false);
    expect(isSafeSegment("COM1")).toBe(false);
    expect(isSafeSegment("LPT9")).toBe(false);
    expect(isSafeSegment("NUL")).toBe(false);
  });

  it("allows names containing reserved as substring", () => {
    expect(isSafeSegment("CONNECT")).toBe(true);
    expect(isSafeSegment("null-skill")).toBe(true);
  });
});
