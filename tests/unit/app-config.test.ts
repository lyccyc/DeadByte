import { describe, expect, it } from "vitest";
import { REQUIRED_BACKEND_ENV, getConfigState } from "@/lib/app-config";

const full = Object.fromEntries(REQUIRED_BACKEND_ENV.map((k) => [k, "value"]));

describe("configuration state", () => {
  it("is demo when nothing is configured", () => {
    expect(getConfigState({})).toMatchObject({ mode: "demo", backendFeaturesEnabled: false });
  });

  it("is misconfigured (fail closed) when only some variables are set", () => {
    const state = getConfigState({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" });
    expect(state.mode).toBe("misconfigured");
    expect(state.backendFeaturesEnabled).toBe(false);
    expect(state.missing).toContain("FLAG_HMAC_SECRET");
  });

  it("treats whitespace-only values as missing", () => {
    expect(getConfigState({ ...full, FLAG_HMAC_SECRET: "  " }).mode).toBe("misconfigured");
  });

  it("is configured when everything is present, but backend stays off until implemented", () => {
    const state = getConfigState(full);
    expect(state.mode).toBe("configured");
    expect(state.missing).toEqual([]);
    expect(state.backendFeaturesEnabled).toBe(false);
  });
});
