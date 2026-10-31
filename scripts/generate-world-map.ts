/**
 * Generates src/components/map/world-map-data.ts from Natural Earth data.
 *
 * Source: Natural Earth 1:110m Admin 0 – Countries (public domain).
 *   https://www.naturalearthdata.com/about/terms-of-use/
 *   Raw file: https://github.com/nvkelso/natural-earth-vector (geojson/ne_110m_admin_0_countries.geojson)
 *
 * Steps:
 *   1. Download the countries GeoJSON (or read a local copy via --input).
 *   2. Assign every polygon to one of seven continents using Natural Earth's
 *      CONTINENT attribute, with two documented adjustments:
 *        - Russia is split at 60°E (approximate Ural boundary): west → Europe, east → Asia.
 *        - Overseas polygons of France (French Guiana) are assigned to South America.
 *   3. Project each vertex with d3-geo's Equal Earth projection.
 *   4. Union the projected polygons per continent (polygon-clipping) to remove
 *      internal borders, then serialise compact SVG path strings.
 *
 * Usage: npx tsx scripts/generate-world-map.ts [--input path/to/countries.geojson]
 * The generated file is committed; this script only needs to be re-run to change the map.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { geoEqualEarth } from "d3-geo";
import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from "polygon-clipping";

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const WIDTH = 1000;
const HEIGHT = 510;

type ContinentId =
  | "antarctica"
  | "north-america"
  | "south-america"
  | "europe"
  | "africa"
  | "asia"
  | "oceania";

const NE_CONTINENT: Record<string, ContinentId | undefined> = {
  Antarctica: "antarctica",
  "North America": "north-america",
  "South America": "south-america",
  Europe: "europe",
  Africa: "africa",
  Asia: "asia",
  Oceania: "oceania",
};

/** Hand-placed marker positions [lon, lat] so markers sit inside the landmass. */
const MARKERS: Record<ContinentId, [number, number]> = {
  antarctica: [20, -75],
  "north-america": [-100, 45],
  "south-america": [-60, -12],
  europe: [18, 50],
  africa: [20, 6],
  asia: [95, 45],
  oceania: [134, -25],
};

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: MultiPolygon };
}

async function loadCountries(): Promise<Feature[]> {
  const inputFlag = process.argv.indexOf("--input");
  if (inputFlag !== -1) {
    const file = process.argv[inputFlag + 1];
    return JSON.parse(readFileSync(file, "utf8")).features;
  }
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Failed to download ${SOURCE_URL}: ${res.status}`);
  return (await res.json()).features;
}

function polygonsOf(feature: Feature): Polygon[] {
  return feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
}

function centroidLon(poly: Polygon): number {
  const ring = poly[0];
  return ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
}

function box(lon0: number, lon1: number): Polygon {
  return [[[lon0, -90], [lon1, -90], [lon1, 90], [lon0, 90], [lon0, -90]]];
}

async function main() {
  const features = await loadCountries();
  const geo: Record<ContinentId, Polygon[]> = {
    antarctica: [], "north-america": [], "south-america": [], europe: [], africa: [], asia: [], oceania: [],
  };

  for (const f of features) {
    const name = String(f.properties.ADMIN ?? f.properties.NAME);
    const continent = NE_CONTINENT[String(f.properties.CONTINENT)];
    const polys = polygonsOf(f);

    if (name === "Russia") {
      for (const p of polys) {
        const west = polygonClipping.intersection(p, box(0, 60));
        const east = polygonClipping.union(
          polygonClipping.intersection(p, box(60, 180)),
          polygonClipping.intersection(p, box(-180, 0)),
        );
        geo.europe.push(...west);
        geo.asia.push(...east);
      }
      continue;
    }
    if (!continent) continue; // "Seven seas (open ocean)" islands are omitted

    for (const p of polys) {
      if (name === "France" && centroidLon(p) < -30) geo["south-america"].push(p);
      else geo[continent].push(p);
    }
  }

  // Fit Equal Earth to the canvas, cropping a little ocean at the top.
  const projection = geoEqualEarth().fitExtent(
    [[8, -24], [WIDTH - 8, HEIGHT]],
    { type: "Sphere" },
  );

  const project = (pt: Ring[number]): [number, number] => {
    const out = projection([pt[0], pt[1]]);
    if (!out) throw new Error(`Projection failed for ${pt}`);
    return [Math.round(out[0] * 10) / 10, Math.round(out[1] * 10) / 10];
  };

  const result: Record<string, { path: string; marker: [number, number]; bbox: [number, number, number, number] }> = {};

  for (const id of Object.keys(geo) as ContinentId[]) {
    const projected: Polygon[] = geo[id].map((poly) => poly.map((ring) => ring.map(project)));
    const merged = projected.length > 1 ? polygonClipping.union(projected[0], ...projected.slice(1)) : projected;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const d = merged
      .map((poly) =>
        poly
          .map((ring) => {
            for (const [x, y] of ring) {
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
            return "M" + ring.slice(0, -1).map(([x, y]) => `${+x.toFixed(1)} ${+y.toFixed(1)}`).join("L") + "Z";
          })
          .join(""),
      )
      .join("");

    result[id] = {
      path: d,
      marker: project(MARKERS[id]),
      bbox: [Math.floor(minX), Math.floor(minY), Math.ceil(maxX), Math.ceil(maxY)],
    };
  }

  const out = `// AUTO-GENERATED by scripts/generate-world-map.ts — do not edit by hand.
// Geometry derived from Natural Earth 1:110m Admin 0 Countries (public domain),
// dissolved into seven continents and projected with Equal Earth.
// See docs/map-provenance.md for details.

export const WORLD_MAP_VIEWBOX = { width: ${WIDTH}, height: ${HEIGHT} } as const;

export interface ContinentShape {
  /** SVG path data in viewBox coordinates. */
  path: string;
  /** Marker anchor [x, y] inside the landmass. */
  marker: readonly [number, number];
  /** Bounding box [minX, minY, maxX, maxY]. */
  bbox: readonly [number, number, number, number];
}

export const CONTINENT_SHAPES = ${JSON.stringify(result, null, 2)} as const satisfies Record<string, ContinentShape>;
`;
  const target = path.join(process.cwd(), "src/components/map/world-map-data.ts");
  writeFileSync(target, out);
  console.log(`Wrote ${target} (${(out.length / 1024).toFixed(1)} KiB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
