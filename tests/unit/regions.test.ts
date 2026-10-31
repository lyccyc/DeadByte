import { describe, expect, it } from "vitest";
import { REGIONS, REGION_SLUGS, getRegion, isRegionSlug } from "@/config/regions";
import { CONTINENT_SHAPES } from "@/components/map/world-map-data";

describe("seven-continent forensic mapping (fixed product decision)", () => {
  it("maps each continent to exactly the approved domain, in order", () => {
    expect(REGIONS.map((r) => [r.slug, r.name, r.forensicDomain])).toEqual([
      ["antarctica", "Antarctica", "Memory Forensics"],
      ["north-america", "North America", "Disk Forensics"],
      ["south-america", "South America", "Mobile Forensics"],
      ["europe", "Europe", "Network Forensics"],
      ["africa", "Africa", "Browser Forensics"],
      ["asia", "Asia", "Cloud Forensics"],
      ["oceania", "Oceania", "File & Artifact Analysis"],
    ]);
  });

  it("has unique slugs, ids, domains and sequential sort order", () => {
    expect(new Set(REGIONS.map((r) => r.slug)).size).toBe(7);
    expect(new Set(REGIONS.map((r) => r.forensicDomain)).size).toBe(7);
    expect(REGIONS.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const r of REGIONS) expect(r.id).toBe(r.slug);
    expect([...REGION_SLUGS]).toEqual(REGIONS.map((r) => r.slug));
  });

  it("includes Antarctica and Oceania explicitly", () => {
    expect(getRegion("antarctica")?.forensicDomain).toBe("Memory Forensics");
    expect(getRegion("oceania")?.forensicDomain).toBe("File & Artifact Analysis");
  });

  it("rejects unknown slugs", () => {
    expect(isRegionSlug("atlantis")).toBe(false);
    expect(getRegion("Antarctica")).toBeUndefined();
    expect(getRegion("")).toBeUndefined();
  });

  it("has a map shape with a non-empty path and in-bounds marker for every region", () => {
    for (const r of REGIONS) {
      const shape = CONTINENT_SHAPES[r.mapId];
      expect(shape.path.length).toBeGreaterThan(100);
      const [x, y] = shape.marker;
      const [x0, y0, x1, y1] = shape.bbox;
      expect(x).toBeGreaterThanOrEqual(x0);
      expect(x).toBeLessThanOrEqual(x1);
      expect(y).toBeGreaterThanOrEqual(y0);
      expect(y).toBeLessThanOrEqual(y1);
    }
  });
});
