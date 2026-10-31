import type { RegionSlug } from "@/config/regions";

export const DIFFICULTIES = ["easy", "medium", "hard", "insane"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CHALLENGE_STATUSES = ["draft", "published", "archived"] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const SORT_OPTIONS = ["newest", "points-desc", "points-asc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/**
 * Upload state of an evidence file.
 * - `not-uploaded`: metadata placeholder only (all demo data). No bytes exist.
 * - `verified`: uploaded to R2, size and SHA-256 verified (Phase 3).
 */
export type EvidenceStatus = "not-uploaded" | "verified";

/** Client-safe evidence metadata. Never contains bucket keys or credentials. */
export interface EvidenceFile {
  id: string;
  displayName: string;
  /** Size in bytes; for `not-uploaded` demo entries this is an illustrative planned size. */
  sizeBytes: number;
  /** Lower-case hex SHA-256, or null until a real file is uploaded and verified. */
  sha256: string | null;
  status: EvidenceStatus;
}

export interface Challenge {
  id: string;
  slug: string;
  region: RegionSlug;
  title: string;
  /** One-line summary for cards. */
  summary: string;
  /** Story / briefing paragraphs. */
  description: string[];
  category: string;
  difficulty: Difficulty;
  points: number;
  status: ChallengeStatus;
  /** ISO timestamp; null for drafts. */
  publishedAt: string | null;
  tags: string[];
  evidence: EvidenceFile[];
  /** Demo-only content is fictional and has no evidence bytes or flags. */
  isDemo: boolean;
  /** Real database challenge explicitly labelled as sample/testing content. */
  isSample?: boolean;
  /** Number of players who solved it; null/undefined when unknown (demo mode). */
  solveCount?: number | null;
}

/** A player's solve of one challenge. */
export interface SolveRecord {
  challengeId: string;
  pointsAwarded: number;
  solvedAt: string;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  insane: "Insane",
};
