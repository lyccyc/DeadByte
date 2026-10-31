"use client";

import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowRight } from "lucide-react";
import { REGIONS, type RegionSlug } from "@/config/regions";
import { ExplorerPenguin } from "@/components/penguin/explorer-penguin";
import { RegionIcon } from "@/components/regions/region-icon";
import { CONTINENT_SHAPES, WORLD_MAP_VIEWBOX } from "./world-map-data";

const { width: W, height: H } = WORLD_MAP_VIEWBOX;

/** Expedition order for the dotted route, starting from the penguin's base in Antarctica. */
const ROUTE: RegionSlug[] = ["antarctica", "south-america", "north-america", "europe", "africa", "asia", "oceania"];

function routePath(): string {
  const pts = ROUTE.map((slug) => CONTINENT_SHAPES[slug].marker);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    // Gentle arc: control point offset perpendicular to the segment.
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2 - Math.abs(x1 - x0) * 0.18 - 10;
    d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1} ${y1}`;
  }
  return d;
}

const ROUTE_D = routePath();

/** Antarctica is a thin strip in most projections; give it a generous hit area. */
const ANTARCTICA_HIT = (() => {
  const [x0, y0, x1, y1] = CONTINENT_SHAPES.antarctica.bbox;
  return { x: x0, y: y0 - 14, width: x1 - x0, height: Math.min(H, y1 + 10) - (y0 - 14) };
})();

export interface WorldMapProps {
  counts: Record<RegionSlug, number>;
}

export function WorldMap({ counts }: WorldMapProps) {
  const router = useRouter();
  const [active, setActive] = useState<RegionSlug | null>(null);
  const activeRegion = REGIONS.find((r) => r.slug === active) ?? null;

  const go = (slug: RegionSlug) => router.push(`/regions/${slug}`);

  const onClick = (slug: RegionSlug) => (e: MouseEvent) => {
    // Let modified clicks (new tab etc.) use native link behaviour.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    go(slug);
  };

  const onKeyDown = (slug: RegionSlug) => (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      go(slug);
    }
    // Enter activates the SVG <a> natively; intercept for client-side navigation.
    if (e.key === "Enter") {
      e.preventDefault();
      go(slug);
    }
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        role="group"
        aria-label="Global Evidence Map: select a continent to open its forensic region"
        data-testid="world-map"
      >
        <defs>
          <pattern id="map-dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#a2adbf" opacity="0.18" />
          </pattern>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* graticule hint */}
        <g stroke="#303849" strokeWidth="0.6" opacity="0.5" aria-hidden="true">
          {[100, 200, 300, 400].map((y) => (
            <line key={y} x1="0" x2={W} y1={y} y2={y} strokeDasharray="2 6" />
          ))}
        </g>

        {REGIONS.map((region) => {
          const shape = CONTINENT_SHAPES[region.mapId];
          const isActive = active === region.slug;
          const dimmed = active !== null && !isActive;
          const count = counts[region.slug] ?? 0;
          return (
            <a
              key={region.slug}
              href={`/regions/${region.slug}`}
              aria-label={`${region.name}: ${region.forensicDomain}, ${count} published challenge${count === 1 ? "" : "s"}`}
              data-region={region.slug}
              className="map-region cursor-pointer"
              onClick={onClick(region.slug)}
              onKeyDown={onKeyDown(region.slug)}
              onMouseEnter={() => setActive(region.slug)}
              onMouseLeave={() => setActive((cur) => (cur === region.slug ? null : cur))}
              onFocus={() => setActive(region.slug)}
              onBlur={() => setActive((cur) => (cur === region.slug ? null : cur))}
            >
              {region.slug === "antarctica" ? (
                <rect {...ANTARCTICA_HIT} fill="transparent" />
              ) : null}
              <path
                d={shape.path}
                fill={isActive ? region.accent : "#1d2738"}
                fillOpacity={isActive ? 0.35 : 1}
                stroke={isActive ? region.accent : "#3a465c"}
                strokeWidth={isActive ? 1.6 : 0.8}
                className="transition-[fill,stroke,opacity] duration-200"
                opacity={dimmed ? 0.55 : 1}
              />
              <path d={shape.path} fill="url(#map-dots)" pointerEvents="none" opacity={dimmed ? 0.4 : 1} />
              {isActive ? (
                <path
                  d={shape.path}
                  fill="none"
                  stroke={region.accent}
                  strokeWidth="2.5"
                  pointerEvents="none"
                  filter="url(#glow)"
                  opacity="0.6"
                />
              ) : null}
              {/* Keyboard focus ring that follows the continent outline (not colour-only: dashed pattern). */}
              <path d={shape.path} className="map-focus-ring" fill="none" stroke="#f1f3f8" strokeWidth="1.2" strokeDasharray="4 3" pointerEvents="none" />
            </a>
          );
        })}

        {/* expedition route */}
        <path
          d={ROUTE_D}
          fill="none"
          stroke="#ff6573"
          strokeOpacity="0.55"
          strokeWidth="1.6"
          strokeDasharray="3 9"
          strokeLinecap="round"
          className="route-anim"
          pointerEvents="none"
          aria-hidden="true"
        />

        {/* markers and labels */}
        <g pointerEvents="none" aria-hidden="true">
          {REGIONS.map((region) => {
            const [x, y] = CONTINENT_SHAPES[region.mapId].marker;
            const isActive = active === region.slug;
            const labelBelow = region.slug !== "antarctica";
            return (
              <g key={region.slug}>
                <circle cx={x} cy={y} r="9" fill={region.accent} className="marker-pulse" />
                <circle cx={x} cy={y} r={isActive ? 6 : 4.5} fill={region.accent} stroke="#0e1421" strokeWidth="1.5" data-marker={region.slug} />
                <text
                  x={x}
                  y={labelBelow ? y + 20 : y - 12}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="11"
                  letterSpacing="1"
                  fill={isActive ? "#f1f3f8" : "#a2adbf"}
                  stroke="#0e1421"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {region.name.toUpperCase()}
                </text>
              </g>
            );
          })}
        </g>

        {/* explorer penguin waiting at base camp near Antarctica */}
        <ExplorerPenguin
          title=""
          aria-hidden="true"
          x={CONTINENT_SHAPES.antarctica.marker[0] - 112}
          y={CONTINENT_SHAPES.antarctica.marker[1] - 78}
          width="62"
          height="70"
          pointerEvents="none"
        />
      </svg>

      {/* Live readout of the hovered / focused region (also announced politely). */}
      <div
        aria-live="polite"
        className="pointer-events-none mt-3 min-h-[4.5rem] rounded-lg border border-border bg-surface/80 px-4 py-3 font-mono text-xs sm:absolute sm:left-3 sm:top-[60%] sm:mt-0 sm:w-56"
        data-testid="map-readout"
      >
        {activeRegion ? (
          <div className="flex items-start gap-3">
            <RegionIcon icon={activeRegion.icon} className="mt-0.5 size-5 shrink-0" style={{ color: activeRegion.accent }} />
            <div>
              <p className="text-sm font-semibold text-fg">{activeRegion.name}</p>
              <p style={{ color: activeRegion.accent }}>{activeRegion.forensicDomain}</p>
              <p className="mt-1 text-muted">
                {counts[activeRegion.slug] ?? 0} published case{(counts[activeRegion.slug] ?? 0) === 1 ? "" : "s"}
              </p>
              <p className="flex items-center gap-1 text-muted">
                <ArrowRight className="size-3" aria-hidden="true" /> Click or press Enter
              </p>
            </div>
          </div>
        ) : (
          <p className="text-muted">
            <span className="text-accent">&gt;</span> Hover or tab to a continent to inspect its evidence domain.
          </p>
        )}
      </div>
    </div>
  );
}
