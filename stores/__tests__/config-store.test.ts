import { describe, it, expect, vi, beforeEach } from "vitest";
import { useConfigStore } from "../config-store";

describe("config-store", () => {
  beforeEach(() => {
    useConfigStore.setState({
      loading: false,
      error: null,
      config: null,
    });
  });

  it("has correct initial state", () => {
    const state = useConfigStore.getState();
    expect(state.loading).toBe(false);
    expect(state.config).toBeNull();
  });

  it("fetchConfig updates loading state", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ installation: { exists: true } }),
    });

    const promise = useConfigStore.getState().fetchConfig();
    expect(useConfigStore.getState().loading).toBe(true);
    await promise;
    expect(useConfigStore.getState().loading).toBe(false);
    expect(useConfigStore.getState().config).toBeDefined();
  });
});
