# Architecture (current state: Phase 0 + Phase 1)

Single Next.js 16 App Router application (TypeScript, Tailwind CSS v4), with
`cacheComponents` + `partialPrefetching` enabled (the create-next-app default).

## Layout

| Path | Purpose |
| --- | --- |
| `src/config/regions.ts` | Single source of truth for the fixed seven-continent → forensic-domain mapping. |
| `src/data/demo-challenges.ts` | Demo-only catalogue (no evidence bytes, no checksums, no flags). Includes one draft and one archived fixture to prove they never leak. |
| `src/lib/challenge-filter.ts` | Pure, client-safe filtering/sorting; only `published` passes. |
| `src/lib/challenges.ts` | Catalogue access layer. Phase 2 swaps the data source for Supabase. |
| `src/lib/flags.ts` | HMAC-SHA256 flag digest + constant-time verify (tested; not yet wired to an endpoint). |
| `src/lib/app-config.ts` | `demo` / `configured` / `misconfigured` detection. `BACKEND_IMPLEMENTED=false` keeps every protected feature off until Phase 2 ships. |
| `src/lib/validation.ts` | Zod schemas: lenient (UI URLs) and strict (API → 400). |
| `src/proxy.ts` | Returns real HTTP 404 for unknown region/challenge slugs (streamed pages can otherwise only soft-404). |
| `src/components/map/` | Interactive SVG map + generated Natural Earth geometry. |
| `src/app/api/v1/` | Public read-only routes: `regions`, `challenges`, `challenges/[slug]`. |

## Honesty rules in the UI

- A site-wide banner states demo mode (or misconfiguration).
- Download, flag submit and auth forms are rendered **disabled**, with an explanation, and have no handlers.
- Evidence sizes in demo data are shown with `~` and "planned · not uploaded"; SHA-256 is not shown until a real verified upload exists.
- The leaderboard shows an empty "offline" state — no sample players.

## Map accessibility

Each continent is an SVG `<a href="/regions/<slug>">` with an `aria-label` containing
continent, domain and published count. Tab focuses continents; Enter and Space open them;
hover/focus updates a polite live readout. Antarctica has an enlarged hit area. The seven
region cards below the map are the primary navigation on small screens.
