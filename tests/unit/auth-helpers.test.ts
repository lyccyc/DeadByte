import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";
import { isUuid } from "@/lib/api";
import { adminChallengeFieldsSchema, adminCreateSchema, parseTags } from "@/lib/admin-validation";

describe("safeNextPath (open-redirect protection)", () => {
  it("allows same-site relative paths", () => {
    expect(safeNextPath("/challenges/the-frozen-memory")).toBe("/challenges/the-frozen-memory");
    expect(safeNextPath("/reset-password/update")).toBe("/reset-password/update");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, 7, "/a\nb"])(
    "rejects %s",
    (value) => {
      expect(safeNextPath(value, "/profile")).toBe("/profile");
    },
  );
});

describe("isUuid", () => {
  it("accepts v4 UUIDs and rejects anything else", () => {
    expect(isUuid("4f1b2c3d-1234-4abc-8def-0123456789ab")).toBe(true);
    expect(isUuid("the-frozen-memory")).toBe(false);
    expect(isUuid("4f1b2c3d-1234-4abc-8def-0123456789ab' or 1=1")).toBe(false);
  });
});

describe("admin challenge validation", () => {
  const valid = {
    slug: "the-frozen-memory",
    region: "antarctica",
    title: "The Frozen Memory",
    difficulty: "easy",
    points: 100,
  };

  it("accepts a minimal valid challenge and applies defaults", () => {
    expect(adminChallengeFieldsSchema.parse(valid)).toMatchObject({ requiresEvidence: true, isSample: false, tags: [] });
  });

  it("rejects unknown regions, bad slugs, non-positive points and unknown keys", () => {
    expect(adminChallengeFieldsSchema.safeParse({ ...valid, region: "atlantis" }).success).toBe(false);
    expect(adminChallengeFieldsSchema.safeParse({ ...valid, slug: "Bad Slug" }).success).toBe(false);
    expect(adminChallengeFieldsSchema.safeParse({ ...valid, points: 0 }).success).toBe(false);
    expect(adminChallengeFieldsSchema.safeParse({ ...valid, status: "published" }).success).toBe(false);
    expect(adminChallengeFieldsSchema.safeParse({ ...valid, created_by: "x" }).success).toBe(false);
  });

  it("limits flag length", () => {
    expect(adminCreateSchema.safeParse({ ...valid, flag: "A".repeat(257) }).success).toBe(false);
  });

  it("normalises comma separated tags", () => {
    expect(parseTags(" Windows, volatility ,windows,, ")).toEqual(["windows", "volatility"]);
  });
});
