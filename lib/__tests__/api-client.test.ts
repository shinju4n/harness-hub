import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the store
vi.mock("@/stores/app-settings-store", () => ({
  useAppSettingsStore: {
    getState: () => ({
      profiles: [
        { id: "default", name: "Default", homePath: "auto" },
        { id: "custom", name: "Custom", homePath: "/custom/path" },
      ],
      activeProfileId: "custom",
    }),
  },
}));

import { getApiHeaders } from "../api-client";

describe("getApiHeaders", () => {
  it("returns x-claude-home header for non-auto profile", () => {
    const headers = getApiHeaders();
    expect(headers["x-claude-home"]).toBe("/custom/path");
  });
});
