import { describe, expect, it, vi } from "vitest";
import { DEMO_CHALLENGES } from "@/data/demo-challenges";

// The catalogue is a Next.js "use cache" function; in unit tests serve the demo catalogue directly.
vi.mock("@/server/catalogue", async () => {
  const { DEMO_CHALLENGES: demo } = await import("@/data/demo-challenges");
  return { getCatalogue: async () => ({ source: "demo", challenges: [...demo], error: null }) };
});
import { isRegionSlug } from "@/config/regions";
import { filterChallenges } from "@/lib/challenge-filter";
import { countPublishedByRegion, getPublishedChallenge, listPublishedChallenges } from "@/lib/challenges";
import type { Challenge } from "@/lib/challenge-types";

const base: Challenge = {
  id: "x",
  slug: "x",
  region: "europe",
  title: "X",
  summary: "",
  description: [],
  category: "Traffic Analysis",
  difficulty: "easy",
  points: 100,
  status: "published",
  publishedAt: "2026-01-01T00:00:00.000Z",
  tags: [],
  evidence: [],
  isDemo: true,
};
const mk = (o: Partial<Challenge>): Challenge => ({ ...base, ...o });

describe("demo catalogue integrity", () => {
  it("uses unique ids and slugs and valid regions", () => {
    expect(new Set(DEMO_CHALLENGES.map((c) => c.id)).size).toBe(DEMO_CHALLENGES.length);
    expect(new Set(DEMO_CHALLENGES.map((c) => c.slug)).size).toBe(DEMO_CHALLENGES.length);
    for (const c of DEMO_CHALLENGES) {
      expect(isRegionSlug(c.region)).toBe(true);
      expect(c.points).toBeGreaterThan(0);
    }
  });

  it("is marked demo and claims no uploaded evidence or checksums", () => {
    for (const c of DEMO_CHALLENGES) {
      expect(c.isDemo).toBe(true);
      for (const f of c.evidence) {
        expect(f.status).toBe("not-uploaded");
        expect(f.sha256).toBeNull();
      }
    }
  });

  it("contains no flag-like strings", () => {
    expect(JSON.stringify(DEMO_CHALLENGES)).not.toMatch(/DEADBYTE\{/);
  });

  it("has at least one published challenge in every region", async () => {
    for (const n of Object.values(await countPublishedByRegion())) expect(n).toBeGreaterThan(0);
  });
});

describe("publication visibility", () => {
  it("never lists draft or archived challenges", async () => {
    const list = await listPublishedChallenges();
    expect(list.every((c) => c.status === "published")).toBe(true);
    expect(list.map((c) => c.slug)).not.toContain("unreleased-draft-case");
    expect(list.map((c) => c.slug)).not.toContain("retired-archived-case");
  });

  it("does not resolve draft/archived challenges by slug, even via search", async () => {
    expect(await getPublishedChallenge("unreleased-draft-case")).toBeUndefined();
    expect(await getPublishedChallenge("retired-archived-case")).toBeUndefined();
    expect(await listPublishedChallenges({ q: "Unreleased" })).toHaveLength(0);
    expect(await listPublishedChallenges({ q: "fixture" })).toHaveLength(0);
  });

  it("does not count hidden challenges per region", async () => {
    const counts = await countPublishedByRegion();
    const expected = DEMO_CHALLENGES.filter((c) => c.status === "published" && c.region === "europe").length;
    expect(counts.europe).toBe(expected);
  });
});

describe("filterChallenges", () => {
  const data = [
    mk({ id: "a", slug: "a", region: "asia", difficulty: "hard", points: 300, publishedAt: "2026-03-01T00:00:00Z", title: "Cloud Ghost" }),
    mk({ id: "b", slug: "b", region: "europe", difficulty: "easy", points: 100, publishedAt: "2026-02-01T00:00:00Z", tags: ["pcap"] }),
    mk({ id: "c", slug: "c", region: "europe", difficulty: "easy", points: 300, publishedAt: "2026-01-01T00:00:00Z" }),
    mk({ id: "d", slug: "d", status: "draft", publishedAt: null }),
  ];

  it("filters by region and difficulty", () => {
    expect(filterChallenges(data, { region: "europe" }).map((c) => c.id)).toEqual(["b", "c"]);
    expect(filterChallenges(data, { difficulty: "hard" }).map((c) => c.id)).toEqual(["a"]);
  });

  it("searches title and tags case-insensitively, ignoring surrounding whitespace", () => {
    expect(filterChallenges(data, { q: "  GHOST " }).map((c) => c.id)).toEqual(["a"]);
    expect(filterChallenges(data, { q: "pcap" }).map((c) => c.id)).toEqual(["b"]);
  });

  it("sorts newest first by default and by points with a deterministic tie-break", () => {
    expect(filterChallenges(data).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(filterChallenges(data, { sort: "points-desc" }).map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(filterChallenges(data, { sort: "points-asc" }).map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("does not mutate its input", () => {
    const copy = [...data];
    filterChallenges(data, { sort: "points-asc" });
    expect(data).toEqual(copy);
  });
});
