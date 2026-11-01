import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGIONS } from "@/config/regions";
import { mapChallengeRow, toParagraphs } from "@/server/catalogue";
import { summarizeProgress } from "@/server/progress";
import type { Challenge } from "@/lib/challenge-types";

const migrationsDir = path.resolve(import.meta.dirname, "../../supabase/migrations");
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(path.join(migrationsDir, f), "utf8"))
  .join("\n");

describe("SQL seed matches src/config/regions.ts", () => {
  it("seeds exactly the seven regions with identical slug, name, domain and order", () => {
    const rows = [...sql.matchAll(/\('([a-z-]+)',\s*'([^']+)',\s*'([^']+)',\s*(\d)\)/g)].map((m) => ({
      slug: m[1],
      name: m[2],
      domain: m[3],
      order: Number(m[4]),
    }));
    expect(rows).toEqual(REGIONS.map((r) => ({ slug: r.slug, name: r.name, domain: r.forensicDomain, order: r.sortOrder })));
  });

  it("enables RLS on every table it creates", () => {
    const tables = [...sql.matchAll(/create table (\w+\.\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThanOrEqual(9);
    for (const t of tables) expect(sql).toContain(`alter table ${t} enable row level security`);
  });

  it("never grants svc_* functions to anon or authenticated", () => {
    expect(sql).not.toMatch(/grant execute on function public\.svc_\w+[^;]*\b(anon|authenticated)\b/);
    expect(sql).toMatch(/revoke all on function %s from public, anon, authenticated/);
  });

  it("does not grant object_key to API roles", () => {
    const grant = sql.match(/grant select \(([^)]*)\)\s+on public\.evidence_files/);
    expect(grant?.[1]).toBeDefined();
    expect(grant![1]).not.toContain("object_key");
  });
});

describe("catalogue row mapping", () => {
  it("splits briefings into paragraphs", () => {
    expect(toParagraphs("First line.\n\n  Second.\r\n\r\nThird")).toEqual(["First line.", "Second.", "Third"]);
  });

  it("maps a database row to a public challenge without storage details", () => {
    const c = mapChallengeRow(
      {
        id: "id1",
        slug: "the-frozen-memory",
        title: "The Frozen Memory",
        summary: "s",
        description: "a\n\nb",
        category: "Memory Analysis",
        tags: ["windows"],
        difficulty: "easy",
        points: 100,
        status: "published",
        is_sample: true,
        published_at: "2026-10-31T00:00:00Z",
        regions: { slug: "antarctica" },
        evidence_files: [{ id: "e1", display_name: "frozen.7z", size_bytes: 42, sha256: "f".repeat(64) }],
      },
      new Map([["id1", 3]]),
    );
    expect(c).toMatchObject({ region: "antarctica", isDemo: false, isSample: true, solveCount: 3, description: ["a", "b"] });
    expect(c!.evidence[0]).toEqual({ id: "e1", displayName: "frozen.7z", sizeBytes: 42, sha256: "f".repeat(64), status: "verified" });
    expect(JSON.stringify(c)).not.toMatch(/object_key|evidence\/challenges/);
  });

  it("drops rows with an unknown region", () => {
    expect(mapChallengeRow({ regions: { slug: "atlantis" } } as never, new Map())).toBeNull();
  });
});

describe("summarizeProgress", () => {
  const mk = (id: string, region: Challenge["region"]): Challenge =>
    ({ id, slug: id, region, title: id, status: "published", points: 100 }) as Challenge;

  it("totals awarded points (incl. archived solves) and counts per region", () => {
    const published = [mk("a", "antarctica"), mk("b", "antarctica"), mk("c", "europe")];
    const solves = [
      { challengeId: "a", pointsAwarded: 100, solvedAt: "2026-10-31T10:00:00Z" },
      { challengeId: "gone", pointsAwarded: 50, solvedAt: "2026-10-30T10:00:00Z" },
    ];
    const p = summarizeProgress(solves, published);
    expect(p.totalPoints).toBe(150);
    expect(p.solvedCount).toBe(2);
    expect(p.regions.find((r) => r.region === "antarctica")).toEqual({ region: "antarctica", solved: 1, total: 2 });
    expect(p.regions.find((r) => r.region === "europe")).toEqual({ region: "europe", solved: 0, total: 1 });
    expect(p.regions).toHaveLength(7);
    expect(p.recent[1].challenge).toBeNull();
  });
});
