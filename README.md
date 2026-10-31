# DeadByte

**Nothing Deleted. Nothing Forgotten.** — a Digital Forensics CTF expedition.

A cyber-explorer penguin travels across seven continents, each a forensic discipline:

| Continent | Domain |
| --- | --- |
| Antarctica | Memory Forensics |
| North America | Disk Forensics |
| South America | Mobile Forensics |
| Europe | Network Forensics |
| Africa | Browser Forensics |
| Asia | Cloud Forensics |
| Oceania | File & Artifact Analysis |

The full product/implementation spec lives in [`CLAUDE.md`](./CLAUDE.md).

## Status

| Phase | State |
| --- | --- |
| 0 — Bootstrap (Next.js, TS, Tailwind, lint/typecheck/test/build) | ✅ Done |
| 1 — Interactive frontend (landing, map, regions, challenges, placeholders) | ✅ Done, **demo data only** |
| 2 — Supabase auth, migrations/RLS, real submissions, leaderboard | ⏳ Not started — needs a Supabase project |
| 3 — R2 evidence upload CLI + signed downloads | ⏳ Not started — needs an R2 bucket + keys |
| 4 — Admin workflow, deploy docs | ⏳ Not started |

**What works today:** browsing the landing page, the clickable/keyboard-accessible
seven-continent map, region pages, challenge search/filter/sort, challenge detail pages,
and read-only JSON APIs — all backed by a clearly labelled demo catalogue.

**What does not work yet (and is visibly disabled):** accounts, flag submission,
evidence downloads, profile stats, leaderboard data, admin. No flags or evidence files exist in this repo.

## Quick start

Requires Node.js ≥ 20.9 (CI uses 22).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. No `.env` is needed for demo mode.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest unit tests (`tests/unit`) |
| `npm run test:e2e` | Playwright (`tests/e2e`) against a production server on port 3100 — run `npm run build` first |
| `npm run map:generate` | Regenerate map geometry from Natural Earth (see `docs/map-provenance.md`) |

## Configuration

Copy `.env.example` to `.env.local`. The app reports one of three states:

- **demo** — no backend variables set. Browse-only.
- **misconfigured** — some but not all set. A warning banner appears; protected features stay off.
- **configured** — all set. *Backend features still remain off until Phase 2 code ships*
  (`BACKEND_IMPLEMENTED` in `src/lib/app-config.ts`).

Never put `SUPABASE_SECRET_KEY`, `FLAG_HMAC_SECRET` or `R2_*` behind a `NEXT_PUBLIC_` prefix.

## Docs

- [`docs/architecture.md`](./docs/architecture.md) — module layout and UI honesty rules
- [`docs/map-provenance.md`](./docs/map-provenance.md) — map data source and licence

## License

See [LICENSE](./LICENSE). Map geometry derived from Natural Earth (public domain).
