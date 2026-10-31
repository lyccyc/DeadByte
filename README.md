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
| 1 — Interactive frontend (landing, map, regions, challenges) | ✅ Done |
| 2 — Supabase auth, migrations/RLS, real submissions, profile, leaderboard, admin publishing | ✅ Code done and tested. **Needs the owner to apply the migration** (see [`docs/database.md`](./docs/database.md)) |
| 3 — R2 evidence upload CLI + signed downloads | ⏳ Not started: needs an R2 bucket and keys |
| 4 — Admin polish (evidence attach UI), deploy docs | ⏳ Not started |

**With Supabase configured and the migration applied:**
- register, confirm email, sign in and out, reset password;
- admins create, edit, publish and archive challenges, and set flags (stored only as HMAC digests);
- players submit flags to a server-side verifier: points are awarded once, attempts are rate-limited, and solves show on `/profile` and `/leaderboard`.

**Without Supabase (demo mode):** the labelled demo catalogue is browsable. Accounts, submission and admin are visibly disabled, and their APIs return `503`.

**Not yet:** evidence downloads (Phase 3). The download button stays disabled with an explanation.

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
| `npm run test:e2e` | Playwright (`tests/e2e`) against a production server on port 3100 — run `npm run build` first (CI runs it in demo mode) |
| `npm run test:db` | Migrations + RLS/scoring/concurrency tests against a disposable Postgres (`TEST_DATABASE_URL`) |
| `npm run set-role -- --email <e> --role admin` | Operator CLI: grant/revoke admin (reads `.env.local`) |
| `npm run map:generate` | Regenerate map geometry from Natural Earth (see `docs/map-provenance.md`) |

## Configuration

Copy `.env.example` to `.env.local`. The app reports one of three states:

- **demo**: no Supabase variables set. Browse-only.
- **configured**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY` and `FLAG_HMAC_SECRET` (≥32 bytes) are all set. Accounts and scoring are on.
- **misconfigured**: some variables are set or invalid. A banner explains the problem without printing values, and protected features stay off.

R2 variables are only needed for Phase 3 evidence downloads.

Never put `SUPABASE_SECRET_KEY`, `FLAG_HMAC_SECRET` or `R2_*` behind a `NEXT_PUBLIC_` prefix. The app treats that as misconfigured.

**First-time Supabase setup:** apply the migration, set the Auth redirect URLs and grant yourself admin. The steps are in [`docs/database.md`](./docs/database.md).

## Docs

- [`docs/architecture.md`](./docs/architecture.md) — module layout, modes, caching and UI honesty rules
- [`docs/database.md`](./docs/database.md) — migrations, Auth setup, admin role, security model, scoring and ranking
- [`docs/map-provenance.md`](./docs/map-provenance.md) — map data source and licence

## License

See [LICENSE](./LICENSE). Map geometry derived from Natural Earth (public domain).
