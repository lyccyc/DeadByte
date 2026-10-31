import { describe, expect, it } from "vitest";
import { formatBytes, formatDate } from "@/lib/format";
import { challengeApiQuerySchema, challengeFilterSchema } from "@/lib/validation";

describe("formatBytes", () => {
  it("formats binary units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2_147_483_648)).toBe("2.0 GB");
    expect(formatBytes(17_179_869_184)).toBe("16.0 GB");
  });
  it("handles invalid sizes", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });
  it("formats dates in UTC", () => {
    expect(formatDate("2026-10-20T23:59:00.000Z")).toBe("2026-10-20");
    expect(formatDate(null)).toBe("—");
  });
});

describe("query validation", () => {
  it("UI parser ignores unknown values instead of failing", () => {
    expect(challengeFilterSchema.parse({ region: "atlantis", difficulty: "EASY", sort: "x", q: "  " })).toEqual({
      region: undefined,
      difficulty: undefined,
      sort: undefined,
      q: undefined,
    });
    expect(challengeFilterSchema.parse({ region: "asia", difficulty: "hard" })).toMatchObject({ region: "asia", difficulty: "hard" });
  });

  it("API parser rejects unknown values and oversized search", () => {
    expect(challengeApiQuerySchema.safeParse({ region: "atlantis" }).success).toBe(false);
    expect(challengeApiQuerySchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
    expect(challengeApiQuerySchema.safeParse({ region: "oceania", sort: "points-desc" }).success).toBe(true);
  });
});
