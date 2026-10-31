/**
 * Single source of truth for the seven DeadByte regions.
 *
 * The continent → forensic domain mapping is a FIXED product decision
 * (see CLAUDE.md §2). Do not reassign domains. The database `regions`
 * table (Phase 2) stores the same stable slugs.
 */

export const REGION_SLUGS = [
  "antarctica",
  "north-america",
  "south-america",
  "europe",
  "africa",
  "asia",
  "oceania",
] as const;

export type RegionSlug = (typeof REGION_SLUGS)[number];

export type RegionIcon =
  | "memory"
  | "disk"
  | "mobile"
  | "network"
  | "browser"
  | "cloud"
  | "file";

export interface Region {
  /** Stable identifier; equal to the slug. */
  id: RegionSlug;
  slug: RegionSlug;
  /** Continent display name. */
  name: string;
  /** Forensic discipline represented by the continent. */
  forensicDomain: string;
  /** One-line themed tagline. */
  tagline: string;
  /** Longer description for region pages. */
  description: string;
  /** Visual metaphor keywords. */
  keywords: readonly string[];
  icon: RegionIcon;
  /** Theme accent colour (hex) used for markers, borders and highlights. */
  accent: string;
  /** Key into the generated world map shapes. */
  mapId: RegionSlug;
  /** Display order (1-based) — matches `regions.sort_order` in the database. */
  sortOrder: number;
}

export const REGIONS: readonly Region[] = [
  {
    id: "antarctica",
    slug: "antarctica",
    name: "Antarctica",
    forensicDomain: "Memory Forensics",
    tagline: "Frozen RAM. Preserved secrets.",
    description:
      "A glacier of volatile memory captured in time. Thaw process lists, network sockets, injected code and forgotten credentials from frozen RAM images.",
    keywords: ["glacier", "frozen RAM", "preserved memory", "frozen evidence"],
    icon: "memory",
    accent: "#8bd3f7",
    mapId: "antarctica",
    sortOrder: 1,
  },
  {
    id: "north-america",
    slug: "north-america",
    name: "North America",
    forensicDomain: "Disk Forensics",
    tagline: "Every sector tells a story.",
    description:
      "Excavate hard drives and filesystem structures. Rebuild partitions, recover deleted files and reconstruct timelines from raw disk images.",
    keywords: ["hard drives", "filesystem structures", "data recovery"],
    icon: "disk",
    accent: "#ffb46b",
    mapId: "north-america",
    sortOrder: 2,
  },
  {
    id: "south-america",
    slug: "south-america",
    name: "South America",
    forensicDomain: "Mobile Forensics",
    tagline: "The phone remembers.",
    description:
      "Trek through smartphone backups and app databases. Follow messages, locations and app artifacts across mobile device investigations.",
    keywords: ["smartphone", "apps", "mobile device investigation"],
    icon: "mobile",
    accent: "#48c39b",
    mapId: "south-america",
    sortOrder: 3,
  },
  {
    id: "europe",
    slug: "europe",
    name: "Europe",
    forensicDomain: "Network Forensics",
    tagline: "Packets never lie.",
    description:
      "Trace packet flows across dense links. Reassemble sessions, carve transferred files and expose suspicious traffic in packet captures.",
    keywords: ["packet flows", "links", "traffic analysis"],
    icon: "network",
    accent: "#7aa2ff",
    mapId: "europe",
    sortOrder: 4,
  },
  {
    id: "africa",
    slug: "africa",
    name: "Africa",
    forensicDomain: "Browser Forensics",
    tagline: "Follow the browser trail.",
    description:
      "Follow trails left in browser history, cookies and cached pages. Reconstruct what was visited, when, and by whom.",
    keywords: ["browser history", "cookies", "cached traces"],
    icon: "browser",
    accent: "#ffc56d",
    mapId: "africa",
    sortOrder: 5,
  },
  {
    id: "asia",
    slug: "asia",
    name: "Asia",
    forensicDomain: "Cloud Forensics",
    tagline: "Ghosts in distributed logs.",
    description:
      "Navigate sprawling cloud audit logs and distributed evidence. Correlate identities, API calls and events across services.",
    keywords: ["cloud logs", "audit events", "distributed evidence"],
    icon: "cloud",
    accent: "#c4a1ff",
    mapId: "asia",
    sortOrder: 6,
  },
  {
    id: "oceania",
    slug: "oceania",
    name: "Oceania",
    forensicDomain: "File & Artifact Analysis",
    tagline: "Beyond the file extension.",
    description:
      "Island-hop through metadata, file signatures and hidden artifacts. Prove what a file really is — and what it hides.",
    keywords: ["metadata", "files", "signatures", "hidden artifacts"],
    icon: "file",
    accent: "#ff8fa3",
    mapId: "oceania",
    sortOrder: 7,
  },
] as const;

const REGION_BY_SLUG: ReadonlyMap<string, Region> = new Map(REGIONS.map((r) => [r.slug, r]));

export function isRegionSlug(value: string): value is RegionSlug {
  return REGION_BY_SLUG.has(value);
}

export function getRegion(slug: string): Region | undefined {
  return REGION_BY_SLUG.get(slug);
}

export function getRegionOrThrow(slug: RegionSlug): Region {
  const region = REGION_BY_SLUG.get(slug);
  if (!region) throw new Error(`Unknown region slug: ${slug}`);
  return region;
}
