import { describe, it, expect, afterEach, vi } from "vitest";
import {
  migrateAppSettings,
  DEFAULT_TERMINAL_HOTKEY,
  hotkeyMatchesEvent,
  isOsReservedHotkey,
  type TerminalHotkey,
} from "../app-settings-store";

describe("migrateAppSettings", () => {
  it("returns persisted state unchanged when it is null", () => {
    expect(migrateAppSettings(null, 1)).toBeNull();
  });

  it("returns persisted state unchanged when it is not an object", () => {
    expect(migrateAppSettings("garbage", 1)).toBe("garbage");
    expect(migrateAppSettings(42, 1)).toBe(42);
  });

  it("v1 → v2: injects the default terminalHotkey when missing", () => {
    const v1 = { theme: "dark", profiles: [], activeProfileId: "default" };
    const result = migrateAppSettings(v1, 1) as Record<string, unknown>;
    expect(result.terminalHotkey).toEqual(DEFAULT_TERMINAL_HOTKEY);
    // Other fields preserved.
    expect(result.theme).toBe("dark");
  });

  it("v2: preserves a valid terminalHotkey untouched", () => {
    const valid = {
      key: "k",
      code: "KeyK",
      ctrl: true,
      meta: false,
      shift: true,
      alt: false,
    };
    const v2 = { theme: "light", terminalHotkey: valid };
    const result = migrateAppSettings(v2, 2) as Record<string, unknown>;
    expect(result.terminalHotkey).toEqual(valid);
  });

  it("v2: preserves explicitly disabled (null) terminalHotkey", () => {
    const v2 = { theme: "light", terminalHotkey: null };
    const result = migrateAppSettings(v2, 2) as Record<string, unknown>;
    expect(result.terminalHotkey).toBeNull();
  });

  it("v2: replaces a malformed terminalHotkey with the default", () => {
    const v2 = { theme: "light", terminalHotkey: { key: "k", ctrl: "yes" /* wrong type */ } };
    const result = migrateAppSettings(v2, 2) as Record<string, unknown>;
    expect(result.terminalHotkey).toEqual(DEFAULT_TERMINAL_HOTKEY);
  });

  it("v2: replaces an empty-key terminalHotkey with the default", () => {
    const v2 = { terminalHotkey: { key: "", ctrl: false, meta: false, shift: false, alt: false } };
    const result = migrateAppSettings(v2, 2) as Record<string, unknown>;
    expect(result.terminalHotkey).toEqual(DEFAULT_TERMINAL_HOTKEY);
  });

  it("v2 legacy: adds an empty `code` field to a hotkey saved before code-based matching", () => {
    const legacy = { key: "`", ctrl: true, meta: false, shift: false, alt: false };
    const v2 = { terminalHotkey: legacy };
    const result = migrateAppSettings(v2, 2) as Record<string, unknown>;
    const upgraded = result.terminalHotkey as Record<string, unknown>;
    expect(upgraded).toMatchObject(legacy);
    expect(upgraded.code).toBe("");
  });

  it("v1 → v2 with no terminalHotkey: still injects default and preserves other fields", () => {
    const v1 = { pollingEnabled: false, theme: "system" };
    const result = migrateAppSettings(v1, 1) as Record<string, unknown>;
    expect(result.terminalHotkey).toEqual(DEFAULT_TERMINAL_HOTKEY);
    expect(result.pollingEnabled).toBe(false);
    expect(result.theme).toBe("system");
  });
});

// Minimal stub of KeyboardEvent for headless matcher tests.
function fakeKey(opts: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: "",
    code: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...opts,
  } as KeyboardEvent;
}

describe("hotkeyMatchesEvent", () => {
  it("matches by code (layout independent)", () => {
    const hk: TerminalHotkey = {
      key: "`",
      code: "Backquote",
      ctrl: true,
      meta: false,
      shift: false,
      alt: false,
    };
    // German QWERTZ: backtick lives on a key whose `e.key` is "[" but the
    // physical position is still "Backquote".
    expect(hotkeyMatchesEvent(hk, fakeKey({ code: "Backquote", key: "[", ctrlKey: true }))).toBe(true);
    // Same code but Shift held → should NOT match (modifiers must align).
    expect(hotkeyMatchesEvent(hk, fakeKey({ code: "Backquote", key: "~", ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it("falls back to case-insensitive key compare when code is missing", () => {
    const legacy: TerminalHotkey = {
      key: "k",
      code: "",
      ctrl: true,
      meta: false,
      shift: false,
      alt: false,
    };
    expect(hotkeyMatchesEvent(legacy, fakeKey({ key: "k", ctrlKey: true }))).toBe(true);
    expect(hotkeyMatchesEvent(legacy, fakeKey({ key: "K", ctrlKey: true }))).toBe(true);
    expect(hotkeyMatchesEvent(legacy, fakeKey({ key: "k", ctrlKey: false }))).toBe(false);
  });

  it("requires every modifier to align (no Cmd-fires-on-Ctrl footgun)", () => {
    const ctrlOnly: TerminalHotkey = { key: "`", code: "Backquote", ctrl: true, meta: false, shift: false, alt: false };
    expect(hotkeyMatchesEvent(ctrlOnly, fakeKey({ code: "Backquote", metaKey: true }))).toBe(false);
  });
});

describe("isOsReservedHotkey", () => {
  // The function consults `navigator.platform` which doesn't exist in
  // node-vitest. Stub it via `vi.stubGlobal` so it auto-unstubs in
  // afterEach below — never leaks into adjacent describes.
  const setPlatform = (value: string | undefined) => {
    vi.stubGlobal("navigator", { platform: value });
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false on non-macOS even for Cmd combos", () => {
    setPlatform("Win32");
    const cmdQ: TerminalHotkey = { key: "q", code: "KeyQ", ctrl: false, meta: true, shift: false, alt: false };
    expect(isOsReservedHotkey(cmdQ)).toBe(false);
  });

  it("flags bare Cmd+H/M/Q/W and Cmd+` on macOS", () => {
    setPlatform("MacIntel");
    const make = (code: string): TerminalHotkey => ({ key: code.slice(-1).toLowerCase(), code, ctrl: false, meta: true, shift: false, alt: false });
    expect(isOsReservedHotkey(make("KeyH"))).toBe(true);
    expect(isOsReservedHotkey(make("KeyM"))).toBe(true);
    expect(isOsReservedHotkey(make("KeyQ"))).toBe(true);
    expect(isOsReservedHotkey(make("KeyW"))).toBe(true);
    expect(isOsReservedHotkey({ key: "`", code: "Backquote", ctrl: false, meta: true, shift: false, alt: false })).toBe(true);
  });

  it("does NOT flag Cmd+Shift+H on macOS (different combo from bare Cmd+H)", () => {
    setPlatform("MacIntel");
    const cmdShiftH: TerminalHotkey = { key: "H", code: "KeyH", ctrl: false, meta: true, shift: true, alt: false };
    expect(isOsReservedHotkey(cmdShiftH)).toBe(false);
  });

  it("does NOT flag Ctrl+H on macOS", () => {
    setPlatform("MacIntel");
    const ctrlH: TerminalHotkey = { key: "h", code: "KeyH", ctrl: true, meta: false, shift: false, alt: false };
    expect(isOsReservedHotkey(ctrlH)).toBe(false);
  });
});
