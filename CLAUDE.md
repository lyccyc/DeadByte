# DeadByte — Claude Code Implementation Specification

> **Purpose:** Build a real, working, publicly accessible Digital Forensics Capture-the-Flag (CTF) platform named **DeadByte**. This file is both the product specification and the implementation instructions for Claude Code. Follow it as the source of truth unless the repository already contains a newer explicit decision from the owner.
>
> **Project status:** Greenfield / early implementation. The owner has an initial visual direction but no confirmed production backend. Start with a polished interactive frontend, then implement the complete CTF workflow incrementally.
>
> **Language:** All application UI copy, code identifiers, technical documentation, sample challenges, and developer comments should be in English by default. Design the UI so internationalization can be added later, but do not implement full i18n in the MVP.

---

## 0. Instructions to the implementation agent

You are the lead full-stack engineer and UI engineer for DeadByte. **Build software, not only plans or wireframes.** Inspect the existing repository before modifying it; preserve working code and adapt this specification to its actual structure. If the repo is empty, scaffold the project. Choose simple, maintainable solutions that can be deployed by one developer.

Working rules:

1. **Do not expand MVP scope** to learning paths, an academy, interactive forensic sandboxes, teams, or scheduled competitions. This is a CTF-first website, with a permanent public challenge library and an all-time leaderboard. Competition events may be added in a later release.
2. Prioritize this order: **brand-consistent landing page → clickable seven-continent map → challenge browser and challenge detail → authentication → real flag submissions and persistent scores → evidence downloads → admin publishing → security/tests/deployment**.
3. Implement responsive, usable pages. If credentials are unavailable, create working demo/mock adapters and a documented setup path, **not fake production success states**. Never claim real authentication, flag validation, or downloads are operational until verified.
4. Never invent credentials, real evidence, a working R2 bucket, deployed URLs, or completed integrations. Use `.env.example` and safe local development fallbacks. Do not commit secrets or real forensic evidence.
5. Use standard, supported libraries; verify their current APIs against official docs when code changes depend on details. Prefer avoiding custom frameworks and premature microservices.
6. Include tests for critical business logic and security. Run available lint, typecheck, build, and test commands. Summarize exactly what passed and what still requires external credentials.
7. Treat user-supplied forensic images as **untrusted downloads**, not server-executed files. Do not automatically execute, unpack, index, or preview potentially malicious forensic evidence on the hosting server.
8. Do not generate arbitrary flags or claim to have authored forensic cases. Create clearly marked **demo-only challenges** with small, harmless fixture files where needed.
9. Make small, understandable commits if the owner has asked for version-control changes; otherwise edit the workspace without forcing git history changes.
10. If uninterrupted implementation is limited, finish the current milestone coherently, document remaining work, and do not leave misleading interactive controls that silently do nothing.

### Definition of success

A new user can visit the DeadByte homepage, explore seven forensic regions, register or sign in, view a published challenge, obtain a genuine authorized download link to evidence when configured, submit a flag to a real server-side verifier, receive points exactly once for the first correct solve, and see that solve reflected in their profile and leaderboard. An administrator can add and publish challenges and associate verified evidence files without placing gigabyte-sized files inside the Next.js deployment.

---

## 1. Product identity and boundaries

### Brand

- **Name:** DeadByte (wordmark styling: `DEADBYTE`, brand text: `DeadByte`).
- **Category:** Digital Forensics CTF platform.
- **Theme:** A cyber-explorer penguin travels across seven continents, each representing a distinct digital forensic discipline. Every challenge is a digital evidence case.
- **Primary tagline:** **Nothing Deleted. Nothing Forgotten.**
- **Secondary tagline:** **Explore the Evidence.**
- **Supporting copy:** `A Digital Forensics CTF Expedition.`
- **Console-style brand line:** `DEADBYTE // EVIDENCE ARCHIVE`
- **Status line:** `CASE STATUS: INVESTIGATING`
- **CTA example:** `START INVESTIGATION` or `[ ACCESSING DIGITAL EVIDENCE... ]` (the second is decorative/loading language, not a fake ongoing action).
- **Flag format for DeadByte-authored sample challenges:** `DEADBYTE{...}`. The verifier must allow challenge-specific formats if desired.

### Target users

- Beginners and experienced CTF participants interested in forensic analysis.
- People practicing Windows/Linux memory analysis, disks, mobile backups, packet captures, browser artifacts, cloud logs, file forensics.
- Users who download evidence and analyze it **on their own computers**, using external tools such as Volatility 3, Autopsy, Wireshark, or domain-specific mobile forensic tools.

### MVP in scope

- Public marketing/landing page and clickable world-map navigation.
- Seven region pages and a browse/filter/search challenge list.
- Challenge detail page, metadata and evidence downloads.
- Email-based signup/login/logout/password reset; optional OAuth (Google/GitHub) later.
- Secure server-side flag validation with recorded attempts and first-solve scoring.
- Personal profile with solved challenges and per-region progress.
- All-time leaderboard with deterministic ranking and pagination.
- Minimal protected admin functionality: create/edit/publish/archive challenges, set flags, attach existing uploaded evidence files.
- Helpful loading, error, empty, access-denied and mobile states.

### Explicitly out of scope for MVP

- Academy lessons, structured learning paths, certificates, prerequisite trees, interactive tutorials.
- Time-boxed competition/event engine, teams, team scoreboards, score freezes, first-blood awards.
- Browser-hosted volatility analysis, malware execution, VMs, forensic lab environments.
- Complex game engines, 3D earth/Three.js, multiplayer avatar movement, microservices/Kubernetes.
- Public user evidence uploads, full forum/writeup publishing, paid subscriptions.

The database should be extendable, but **do not implement future features merely to prepare for them**.

---

## 2. Seven continents = seven forensic domains (FIXED MAPPING)

**The following mapping is the user's latest approved design decision. Do not substitute earlier suggestions or reassign domains.** Use it consistently in seed data, navigation, graphics, labels, routes, counts and tests.

| Region / Continent | Route slug | Forensic domain | Visual metaphor / keywords |
| --- | --- | --- | --- |
| Antarctica | `antarctica` | **Memory Forensics** | Glacier, frozen RAM, preserved/forgotten memory, frozen evidence |
| North America | `north-america` | **Disk Forensics** | Hard drives, filesystem structures, data recovery |
| South America | `south-america` | **Mobile Forensics** | Smartphone, apps, mobile device investigation |
| Europe | `europe` | **Network Forensics** | Packet flows, links, traffic analysis |
| Africa | `africa` | **Browser Forensics** | Browser history, cookies, cached traces |
| Asia | `asia` | **Cloud Forensics** | Cloud logs, audit events, distributed evidence |
| Oceania | `oceania` | **File & Artifact Analysis** | Metadata, files, signatures, hidden artifacts |

Create one source of truth such as `src/config/regions.ts` containing ordered region id, slug, display name, forensic domain, description, icon identity, theme accent and optional map identifier. The database stores stable region slugs/identifiers too. Do not duplicate hardcoded mapping in seven different components.

### Content examples

- Antarctica: `The Frozen Memory` — Windows 11 memory acquisition and artifact investigation.
- North America: `The Missing Partition` — disk image/filesystem analysis.
- South America: `Lost Phone, Found Clues` — Android device backup artifacts.
- Europe: `Packets Never Lie` — PCAP traffic investigation.
- Africa: `The Browser Trail` — cookies/history/cache.
- Asia: `Ghosts in the Cloud` — cloud audit logs.
- Oceania: `Beyond the File Extension` — metadata and file signatures.

These are demo titles, **not claims that actual evidence files or solutions already exist**.

---

## 3. Visual direction / design system

### Aesthetic

- **Dark cyber-forensics archive**: near-black navy surfaces, muted blue-gray typography, coral/deep-orange-red accents, subtle cyber grid, terminal details, small scanlines and glitch highlights.
- **Approachable explorer character**: a cute stylized penguin carrying forensic/cyber exploration gear (backpack, small scanner, magnifying glass or device). A cute character must coexist with a technically serious layout.
- Aim for a custom polished brand, not a generic hacker-dashboard template or a copy of an existing CTF site.
- Make the world-map exploration a **real navigation mechanism**, not a decorative image without interactive semantics.
- Keep body text highly readable. Use visual effects sparingly; support `prefers-reduced-motion` and never rely on flashing content.

### Design tokens (adjust slightly only if necessary for contrast)

```css
:root {
  --background: #0e1421;
  --surface: #151d2c;
  --surface-elevated: #1d2738;
  --surface-border: #303849;
  --text-primary: #f1f3f8;
  --text-secondary: #a2adbf;
  --accent: #ff6573;
  --accent-hover: #ff8490;
  --success: #48c39b;
  --warning: #ffc56d;
  --danger: #f87171;
}
```

Typography: **Space Grotesk** for headings/UI; **JetBrains Mono** for terminal labels, flags, metadata, code and technical details. Use graceful system-font fallbacks. Avoid unnecessarily large bundled assets.

### Landing page layout

1. Responsive navigation: wordmark `DEADBYTE // EVIDENCE ARCHIVE`, `Explore`, `Challenges`, `Leaderboard`, `Login`/avatar.
2. Hero: `CASE STATUS: INVESTIGATING`, large `Nothing Deleted. Nothing Forgotten.`, one-line intro, primary `START INVESTIGATION` CTA.
3. **Global Evidence Map:** interactive seven-continent world map, seven hover/focus targets, explorer penguin near Antarctica at first launch, clear mapping and accessible region labels.
4. Region summary cards or equivalent mobile fallback so every region is reachable without precision clicking.
5. Featured/newest published challenges (real DB after integration; labeled mock data during frontend phase).
6. Small leaderboard preview, only once real scoreboard is available; demo preview must be explicitly labeled.
7. Footer with GitHub/source links only if actually known and configured; otherwise omit invented URLs.

### Map design guidelines

- Prefer a well-formed, **licensed or original SVG** with recognizable geographic silhouettes and separate hit areas for seven continents. Record provenance/licensing in the repo when importing a map asset.
- Each continent is keyboard focusable and clickable; hover/focus shows the region title, corresponding domain, available challenge count and a clear affordance. Enter/Space opens `/regions/[slug]`.
- Antarctica remains visible and selectable, even if it needs a separate inset or accessible callout.
- Do not use inaccurate hand-drawn geographic polygons as the final map. A stylized but recognizable world map is acceptable.
- A small pink/coral dotted expedition route and glowing markers can connect regions. Keep animation subtle.
- Do not move the penguin continuously or block access to content. Support a static asset or simple CSS/SVG penguin if illustration assets are unavailable.
- Mobile: replace precision map interactions with seven large, tappable cards or an accessible horizontal region list. Retain the map as secondary context if space allows.
- Add hover, focus-visible and selected states; avoid color-only meaning.

### Other page components

- Challenge cards: region, category, difficulty, title, points, solve count (if available), solved state, evidence size.
- Challenge detail: title, story/description, metadata, downloadable file(s), SHA-256, flag input and response, optional challenge hints deferred.
- Leaderboard: rank, avatar fallback, username, points, solved count; privacy-conscious public data.
- Profile: username, total points, solved cases, seven-region progress grid; no gimmicky fake statistics.
- Admin: compact functional forms that are clear and secure; aesthetics secondary to correctness.

---

## 4. Recommended technical stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Web frontend | **Next.js App Router**, React, **TypeScript** | Favor Server Components where appropriate; client components only for interactive widgets. |
| Styling | **Tailwind CSS** + CSS variables | Component styling, responsive layouts, dark theme, reduced motion. |
| Icons | **lucide-react** | Lightweight SVG icons. |
| Animations | CSS transitions; optionally Motion/Framer Motion | No heavy animation dependency unless it materially helps. |
| Validation | **Zod** | Validate all API input, avoid trusting the browser. |
| Identity | **Supabase Auth** + `@supabase/ssr` | Cookie-based Next.js sessions, proper server-side user verification. |
| Database | **Supabase PostgreSQL** | SQL migrations, constraints, RLS; no extra ORM required for MVP. |
| Evidence storage | **Cloudflare R2 Standard** | Private S3-compatible bucket; direct downloads with short-lived signed URLs. |
| S3 client | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/lib-storage` | Upload multi-GB files with streaming multipart uploads. |
| Deployment | **Vercel** for Next.js + Supabase + Cloudflare | Verify budget/limits before public launch. |
| Rate limiting | Managed Redis/Upstash or another distributed limiter | Required for public submission/download endpoints; do not rely on in-process Map in serverless production. |
| Tests | **Vitest** + **Playwright** + DB RLS tests | Unit, integration and browser behavior. |
| CI | GitHub Actions | Lint, typecheck, build and tests with secrets isolated. |

### Important implementation constraints

- Use one Next.js application and an organized server/service layer. **Do not** build independent microservices for this MVP.
- Keep secret-bearing code in server-only modules (`import 'server-only'` when appropriate).
- Use Node.js runtime for routes requiring Node `crypto` or AWS SDK; never bundle these functions into the client.
- Follow current Supabase SSR documentation rather than outdated Auth Helpers.
- Use **Supabase publishable keys** for public/server-authenticated clients; use a **Supabase secret key** (or legacy service-role key only where required) solely in privileged backend code. Never expose privileged keys through `NEXT_PUBLIC_*` or browser bundles.
- Preserve the ability to use local mock data for UI development without requiring production secrets. Clearly separate demo mode from production mode.

---

## 5. Proposed repository structure

```text
deadbyte/
├── CLAUDE.md                           # this document
├── README.md                           # setup, environment, deployment and runbook
├── .env.example                        # placeholder variable names only
├── package.json
├── public/
│   ├── maps/world.svg                  # verified/licensed interactive source asset
│   └── images/penguin/                 # custom or properly licensed art
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── challenges/page.tsx
│   │   ├── challenges/[slug]/page.tsx
│   │   ├── regions/[slug]/page.tsx
│   │   ├── leaderboard/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── admin/challenges/page.tsx
│   │   ├── admin/challenges/new/page.tsx
│   │   └── api/v1/
│   │       ├── regions/route.ts
│   │       ├── challenges/route.ts
│   │       ├── challenges/[slug]/route.ts
│   │       ├── challenges/[id]/submit/route.ts
│   │       ├── evidence/[id]/download/route.ts
│   │       ├── leaderboard/route.ts
│   │       ├── me/progress/route.ts
│   │       └── admin/...
│   ├── components/
│   │   ├── layout/
│   │   ├── map/
│   │   ├── penguin/
│   │   ├── challenges/
│   │   ├── leaderboard/
│   │   └── ui/
│   ├── config/regions.ts
│   ├── data/demo-challenges.ts
│   ├── lib/
│   │   ├── supabase/{browser,server,admin}.ts
│   │   ├── r2/client.ts
│   │   ├── flags.ts
│   │   ├── authorization.ts
│   │   └── validation.ts
│   ├── server/
│   │   ├── challenges/
│   │   ├── submissions/
│   │   ├── evidence/
│   │   └── leaderboard/
│   └── types/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
├── scripts/
│   └── upload-evidence.ts              # streaming multipart local admin CLI
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── architecture.md
    ├── r2-setup.md
    ├── admin-runbook.md
    └── deployment.md
```

This is a target structure, not a demand to create empty placeholder files. Follow actual App Router route conventions and avoid competing duplicate implementations.

---

## 6. Data model: minimal, production-minded SQL schema

Implement reversible, checked-in SQL migrations. Prefer generated UUID primary keys, UTC timestamps (`timestamptz`), explicit foreign keys, indexes and unique constraints. Keep the public `regions` mapping stable.

### `public.profiles`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `username citext unique not null` (or equivalent case-insensitive unique index)
- `avatar_url text null`, `created_at timestamptz`, `updated_at timestamptz`
- Public display profile: username and optional avatar only. Avoid exposing email.
- Owner may edit only approved profile fields; **never** roles or points.

### `private.user_roles`

- `user_id uuid references auth.users(id)`, `role text check (role in ('admin','player'))`, unique per user
- Protected schema; assigned or modified by a trusted administrator, not user-controlled JSON/JWT metadata.
- All admin routes **must** perform a server-side role check.

### `public.regions`

- `id uuid primary key`, `slug text unique not null`, `name text not null`, `forensic_domain text not null`, `sort_order int unique not null`
- Seed exactly the seven rows in section 2, in that order.
- The map/UI's typed config may include visual-only content and a stable slug reference.

### `public.challenges`

- `id uuid primary key`, `slug text unique not null`, `region_id uuid not null references regions(id)`
- `title text`, `description text`, `difficulty text check in ('easy','medium','hard','insane')`
- `points integer not null check (points > 0)`, `status text check in ('draft','published','archived')`
- `published_at timestamptz null`, `created_by uuid references auth.users(id)`
- `created_at timestamptz`, `updated_at timestamptz`
- Only **published** challenges are shown to anonymous users. Draft/archived details never leak through search, indexes, data API or download endpoints.
- Editing a published challenge's points **must not retroactively change points already awarded**; store awarded points on solve rows.

### `public.evidence_files`

- `id uuid primary key`, `challenge_id uuid not null references challenges(id) on delete cascade`
- `display_name text`, `object_key text unique not null`, `size_bytes bigint not null check(size_bytes >= 0)`
- `sha256 text not null`, `mime_type text null`, `created_at timestamptz`, `is_active boolean default true`
- Private R2 object identifier is server-only internal metadata; expose display name, size and checksum to clients, **never privileged bucket credentials**.
- A file is downloadable only if it belongs to a published challenge and is active.
- Use immutable object keys (e.g. `evidence/challenges/<uuid>/v1/<file-uuid>.7z`) so replacing evidence requires an explicit new record/version and SHA-256.

### `private.flag_verifiers`

- `challenge_id uuid primary key references public.challenges(id) on delete cascade`
- `digest text not null`, `algorithm text not null default 'hmac-sha256-v1'`, `updated_at timestamptz`
- Compute **HMAC-SHA256** using a strong server-only `FLAG_HMAC_SECRET`; store only the expected digest. HMAC with a server-side secret is preferable to a plain unsalted hash for potentially guessable flags.
- Do not return digests or plaintext flags to users, expose this table via Supabase Data API, or commit real flags to git.
- Submit normalization policy: trim only accidental surrounding whitespace; otherwise preserve exact bytes and case by default. Document any per-challenge alternatives before using them.
- For constant-time digest comparison, use Node `crypto.timingSafeEqual` on validated equally sized byte buffers; reject malformed input safely.

### `public.submissions`

- `id uuid primary key`, `user_id uuid references auth.users(id)`, `challenge_id uuid references challenges(id)`
- `is_correct boolean not null`, `submitted_at timestamptz default now()`
- Do **not** store raw attempted flags by default; input may contain accidental secrets. If audit data is necessary, store minimal metadata.
- Index on `(user_id, submitted_at desc)` and `(challenge_id, submitted_at desc)`.
- Players can read only their own submission history; only the trusted submit service can insert attempts.

### `public.solves`

- `id uuid primary key`, `user_id uuid references auth.users(id)`, `challenge_id uuid references challenges(id)`
- `points_awarded integer not null`, `solved_at timestamptz default now()`
- `unique(user_id, challenge_id)` is mandatory.
- `points_awarded` is captured from published challenge points **at the first valid solve**.
- Source of truth for the all-time leaderboard: `SUM(points_awarded)` grouped by user. No browser-writable `total_points` field.
- Players may read their own solves; public scoreboard may disclose aggregates and usernames, not private raw activity unless clearly chosen.

### `private.admin_audit_logs` (simple but recommended)

- `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `created_at`, and sanitized JSON details.
- Record create/publish/archive/evidence association actions. Never log flags, tokens or signed URLs.

### Database authorization and atomicity

- RLS enabled on every exposed table; explicit `GRANT`s and per-operation policies tested with anonymous, owner, other player and administrator identities.
- Do not expose privileged tables or unsafe `SECURITY DEFINER` functions from an API-exposed schema. Keep privileged functions in a non-exposed private schema with locked `search_path` and narrow execution grants.
- Implement a single **trusted server-side submission flow** which verifies the flag, records the attempt, and inserts the solve with `ON CONFLICT DO NOTHING` as appropriate. The correct-solve attempt and initial points award should be atomically committed with a database transaction/function. Race conditions must not award a second solve.
- Because a backend-side HMAC check and an SQL transaction are two separate steps, pass only a server-trusted verification result to the privileged recording operation; ensure ordinary clients cannot call the awarding operation directly.
- Keep public challenge pages and leaderboard queries properly indexed and paginated. Avoid caching user-specific protected data in a shared/static cache.

---

## 7. Public pages and user flows

### Page: `/`

The home/landing page in the specified dark style. Show hero, penguin, world map, regions and recently published challenges. Logged-out users can browse. `START INVESTIGATION` scrolls to the map or opens `/challenges`, and must actually work.

### Page: `/regions/[slug]`

- Render only valid region slugs; unknown slug returns 404.
- Show region title, forensic domain, themed description, progress count if logged in, challenge cards and filters by difficulty/solved status.
- Reuse one template across all seven continents.

### Page: `/challenges`

- Search by title/tags if tags are implemented; filter by region/difficulty/solved status and sort by newest/points.
- Show sensible empty and loading states; URL query params should preserve filters when convenient.

### Page: `/challenges/[slug]`

- Render published challenge only (unless authenticated admin preview mode).
- Show story/description, region, difficulty, points, filename, bytes in human-readable units, SHA-256 and download action.
- Logged-out users may view public details but must sign in to download private evidence and submit flags (default MVP policy).
- Flag input accepts `DEADBYTE{...}` by sample convention, sends it only to the backend, and displays a proper verified response. No client-side comparison.
- A solved challenge displays `Solved` and awarded points; repeat correct submissions cannot award more points.

### Auth pages

- `/login`, `/register`, `/reset-password`, email verification redirect flow, logout.
- Use Supabase-supported SSR cookie sessions and validated server authentication. Handle expired sessions and password reset redirects securely.
- Unique public username; no email disclosure in public leaderboard.

### `/profile`

- Authenticated profile with total points, solved count, seven domain progress summaries, recent solved challenge entries.
- Username/avatar editing when safe; no ability to set admin role or points.

### `/leaderboard`

- Public top players: rank, username, points, solved count, tied-rank policy documented (e.g. points descending, latest solve time ascending, username as final stable tie breaker).
- Paginate; show only real data when connected to DB. Empty state when no players.

### `/admin` and `/admin/challenges`

- Strongly protected pages and backend endpoints.
- Create/edit draft challenge, assign region, difficulty, points, description, correct flag, associate uploaded evidence by ID/object key (validated), publish/archive.
- Show real upload status (`pending`, `verified`, `attached`), do not mark an object available without checking it exists and matches the expected metadata.
- An initial **trusted local CLI** for uploading large files is acceptable; do not force browser-based upload of 8–16 GB files in Phase 1.

---

## 8. HTTP API contract (Next.js Route Handlers)

Namespace APIs under `/api/v1`. Add Zod schemas, auth/role guards, consistent JSON responses, server-side logs (sanitized), and meaningful HTTP status codes. Paths below are design targets; implement only the routes required for the current milestone, but align naming consistently.

| Method | Route | Auth | Meaning |
| --- | --- | --- | --- |
| GET | `/api/v1/regions` | Public | Seven regions with published challenge counts. |
| GET | `/api/v1/challenges` | Public | Paginated published challenges; filters `region`, `difficulty`, `q`, `sort`. |
| GET | `/api/v1/challenges/:slug` | Public | Published challenge detail and non-sensitive evidence metadata. |
| POST | `/api/v1/challenges/:id/submit` | Player | Submit `{ "flag": "DEADBYTE{...}" }`; verify and record. |
| POST | `/api/v1/evidence/:id/download` | Player | Verify access; return short-lived R2 signed GET URL. |
| GET | `/api/v1/leaderboard` | Public | Paginated aggregate all-time scores. |
| GET | `/api/v1/me/progress` | Player | Personal solves and region stats. |
| GET | `/api/v1/me/submissions` | Player | Own attempts only, paginated. |
| POST | `/api/v1/admin/challenges` | Admin | Create draft challenge and private flag verifier. |
| PATCH | `/api/v1/admin/challenges/:id` | Admin | Update permitted fields. |
| POST | `/api/v1/admin/challenges/:id/publish` | Admin | Validate requirements; make challenge public. |
| POST | `/api/v1/admin/evidence/register` | Admin | Validate/attach verified R2 object metadata. |

### Example: flag submission

Request:

```http
POST /api/v1/challenges/4f.../submit
Content-Type: application/json
Cookie: <authenticated session>

{"flag":"DEADBYTE{example}"}
```

Response for a **first** correct solve:

```json
{
  "correct": true,
  "alreadySolved": false,
  "pointsAwarded": 100,
  "message": "Evidence recovered. Challenge solved."
}
```

Response for a repeat correct submission:

```json
{
  "correct": true,
  "alreadySolved": true,
  "pointsAwarded": 0,
  "message": "You already solved this challenge."
}
```

Failed attempt: `correct: false`, `pointsAwarded: 0`; do not reveal expected flag or verifier details.

### Rate limiting and abuse controls

- Public deployment must rate-limit per authenticated user (suggested baseline: **10 flag submissions/minute**, configurable) and optionally IP for anonymous-sensitive routes.
- Evidence download grant endpoint: rate-limit grants, but make limits reasonable for failed/resumed large downloads.
- Return HTTP 429 with appropriate `Retry-After` guidance. Use a **distributed** limiter under serverless deployment; an in-memory counter is only a local development fallback.
- Protect registration against obvious bot abuse with email verification and, if needed, Cloudflare Turnstile. Never treat CAPTCHA as a substitute for authorization.

---

## 9. Large forensic evidence architecture (R2)

### Motivation

Evidence files can be multi-gigabyte raw memory images, forensic disk images, mobile backup archives or packet captures. Typical illustrative sizes range from hundreds of MB to **4–16+ GB**, with some disk images much larger. Never commit them to git, place them in Next.js `public/`, bundle them into Vercel functions, or proxy full downloads through the web server.

### Storage strategy

- Cloudflare **R2 Standard** private bucket (suggested bucket name `deadbyte-evidence-prod`; separate dev bucket).
- Use S3-compatible SDK to upload and access objects.
- Metadata lives in Supabase, file bytes live in R2.
- Organize by immutable object keys, not user-provided raw paths:

```text
s3://deadbyte-evidence-prod/
  evidence/
    challenges/
      <challenge-uuid>/
        v1/
          <file-uuid>.7z
        v2/
          <file-uuid>.E01
```

### Admin uploads

- Build `scripts/upload-evidence.ts` first: local/admin-only Node CLI, arguments like `--challenge <id> --file <path>`, credentials read from environment only.
- Stream input rather than reading giant files into memory. Use `createReadStream`, `@aws-sdk/lib-storage` multipart `Upload` (configurable concurrency/part size) and `crypto.createHash('sha256')` streaming hash.
- Upload large files with Multipart Upload; show progress and explicit failure handling; abort or clean unfinished multipart uploads.
- After upload, verify object existence, size and expected metadata using HEAD; record known SHA-256 (the R2 multipart ETag **is not** a SHA-256 checksum).
- Produce a sanitized upload manifest with object key, display filename, size, SHA-256. Make it possible for admin UI to associate this uploaded object with a draft challenge.
- Do not allow challenge publication when required evidence is missing/unverified.
- A browser-based admin multipart upload UI may be implemented later, but it must upload directly to R2 with securely authorized multipart coordination, never via Vercel function bodies.

### User downloads

1. Authenticated user clicks `DOWNLOAD EVIDENCE` on a published challenge.
2. `POST /api/v1/evidence/:id/download` verifies user session, publication status, file active status, abuse rules and object mapping.
3. Backend constructs a **short-lived (e.g. 5–15 minutes) presigned GET URL** using the R2 S3 API endpoint.
4. Browser downloads **directly from R2**. No Next.js/Vercel bandwidth proxy.
5. UI displays filename, size and SHA-256; optionally a copy-to-clipboard checksum affordance.
6. Support browser and CLI download; test HTTP Range/resume behavior (`curl -C -`) on a real R2 object.

**Important R2 constraints:** A single PUT supports up to 5 GiB; Multipart Upload supports much larger objects (documented up to 5 TiB). R2 presigned URLs use the `*.r2.cloudflarestorage.com` S3 API hostname, not a custom domain. Signed URLs are bearer capabilities: anyone possessing an unexpired URL may use it. Do not log them, permanently store them, or treat them as revocable one-user tokens.

### Security and evidence hygiene

- Publish only synthetic, intentionally authored datasets or evidence with permission and thoroughly reviewed contents.
- Memory captures and phone backups may contain personal data, credentials, API keys, session tokens, malware, and privileged secrets. Review and sanitize as part of challenge authoring.
- Keep public CTF evidence isolated from real private forensic cases. Do not index or execute unknown content on application hosts.
- Require checksum validation and descriptive safety notices for potentially risky files.
- Do not assume archives reduce every raw memory image or forensic disk image significantly; support uncompressed files where warranted.

---

## 10. Implementation phases and acceptance criteria

### Phase 0 — Project bootstrap

**Deliverables:** Next.js + TypeScript + Tailwind with consistent branding, usable npm scripts, `.env.example`, README, initial test tooling, no hardcoded secrets.

- Use the current `create-next-app` official defaults or explicit TS/Tailwind/App Router flags.
- Install dependencies only when needed; set up lint, typecheck, tests and build scripts.
- Define region mapping, design tokens, shared layout/navigation and demo fixture data.

**Acceptance:** `npm run dev`, `npm run lint`, `npm run typecheck`, and `npm run build` succeed, or the exact known blocker is documented.

### Phase 1 — Interactive frontend (FIRST PRIORITY)

**Deliverables:** Fully responsive DeadByte landing page, accessible seven-continent map, seven reusable region pages, challenge list/detail, login/profile/leaderboard placeholders with explicitly labeled demo content.

- Implement hero + dark cyber aesthetics + subtle glitch treatments.
- Implement keyboard-and-pointer-enabled map and mobile list/card fallback.
- Make navigation real: Antarctica opens Memory Forensics, etc.
- Include a recognizable explorer penguin; use a simple custom scalable fallback if no professional illustration is available.
- Make all buttons behave honestly; non-integrated backend controls should be visibly disabled or labeled demo, not silently pretend to submit.

**Acceptance:** Every continent routes to the correct domain, mobile UI remains navigable at ~375px, and the main CTA works. Include Playwright checks for mapping and major navigation.

### Phase 2 — Database, authentication, real CTF submissions

**Deliverables:** Supabase auth, SQL migrations, RLS, challenge publishing data flow, server-side flag verification, persistent submissions/solves, profile and live leaderboard.

- Implement role-based admin access and database constraints.
- Seed seven regions, and only clearly labeled sample data with a known test flag where appropriate.
- Add anti-double-award transaction logic and request validation.
- Add rate limiting before public deployment.

**Acceptance:** User A solves once and receives points once; user B cannot read A's private submissions or spoof A's score; anonymous caller cannot submit; admin route denied to regular players; RLS tests cover both allowed and denied paths.

### Phase 3 — Evidence workflow

**Deliverables:** R2 bucket configuration, local streaming multipart upload CLI, metadata registration, short-lived signed downloads, checksum display, admin attach flow.

- Test with one tiny synthetic fixture first, then a large file if the owner supplies one.
- Do not need real 8 GB evidence to build UI; do test the true R2 end-to-end signed download with owner-provided credentials before marking complete.

**Acceptance:** Admin uploads a file, SHA-256 and size are persisted, and logged-in player downloads the same bytes from R2; private/draft evidence access is denied; expired links fail; verify resume where supported.

### Phase 4 — Admin workflow, testing, deploy readiness

**Deliverables:** Admin create/edit/publish/archive pages, error pages, responsive polish, accessibility audit, GitHub Actions CI, deployment/runbook docs.

**Acceptance:** A fresh maintainer can set up Supabase + R2 using README, deploy to Vercel after supplying secrets, publish one challenge and test the full user flow. No admin or secret-bearing data is exposed in browser bundles or public Supabase policies.

### Phase 5 — Future additions, NOT MVP

- Timed events and separate event scoreboards, independent challenge evidence/flags for competitions.
- Team participation, first blood, dynamic scoring, hints/penalties, achievements.
- Official writeups and optional learning paths if the platform matures.

Do not implement Phase 5 unless the owner requests it explicitly.

---

## 11. Environment variables and local setup

Create `.env.example` with names and explanatory comments, **never actual tokens**:

```dotenv
# Public: safe to expose in the browser
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Server only: NEVER prefix these with NEXT_PUBLIC_
SUPABASE_SECRET_KEY=
FLAG_HMAC_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=deadbyte-evidence-dev

# Optional distributed rate limiter for deployment
RATE_LIMIT_REDIS_URL=
RATE_LIMIT_REDIS_TOKEN=
```

Adapt variable names to the actual supported provider SDK version; document any aliases. The secret key is for trusted server-only admin access. Prefer strong random `FLAG_HMAC_SECRET` bytes and document secure rotation implications. Explain how to set auth redirect URLs and R2 CORS only when required by the actual browser download/upload implementation.

Suggested bootstrap commands:

```bash
npx create-next-app@latest deadbyte --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd deadbyte
npm install @supabase/supabase-js @supabase/ssr zod lucide-react
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage
npm run dev
```

Add testing and rate-limit packages as the features are implemented. Do not blindly execute scaffold commands inside an established nonempty repository; inspect files first.

The app must have a **clear configuration state**:

- `demo` (no credentials): browse prototype/demo content, no implied real auth, server verification or downloadable evidence.
- `configured` (real Supabase and R2): persistent features enabled only when setup is valid.
- `misconfigured`: explicit actionable diagnostics, especially on admin screens and server logs; fail closed on protected routes.

---

## 12. Tests, operational requirements, and secure launch checklist

### Automated tests

- Exact seven-continent slug/domain mapping (including Antarctica and Oceania).
- Navigation, focus and mobile menu accessibility.
- `published` challenges visible; `draft` and `archived` hidden from unauthenticated/public query.
- Flag HMAC verifier: correct/incorrect, whitespace policy, empty/oversized input, malformed values and case policy.
- Submit endpoint: unauthenticated rejected; correct solved once; duplicate submissions never add points; simultaneous correct requests award once.
- Profile privacy and RLS: users cannot inspect others' submissions, write solves or elevate roles.
- Admin authorization: regular player denied all admin operations, including HTTP endpoints called directly.
- Evidence authorization: unknown/inactive/draft object denied; valid signed link expires; no R2 secret in response.
- Leaderboard calculation and tie order.
- Admin publish validation: challenge requires valid flag verifier and appropriate evidence references.

### Operational checklist

- Use HTTPS in production; deploy with appropriate security headers and cookie flags.
- Add bot protection where needed and rate limits at auth/submit/download grant edges.
- Configure monitoring for application errors, database failures, upload errors and unusual download attempts.
- Set sensible DB backup/restore policy; R2 object backup/retention strategy commensurate with data ownership.
- Protect personal information: collect only needed profile data; provide privacy/terms and a contact mechanism before opening public registration.
- Confirm Cloudflare/Supabase/Vercel quotas and spend alerts before advertising public downloads.
- Verify evidence licenses/consent and conduct an artifact/privacy review prior to publishing any real memory/mobile image.
- Validate deployment variables in both production and preview environments; no cross-environment bucket leakage.
- Never expose admin tools, private flags, database secret keys or R2 credentials through `NEXT_PUBLIC_*`, static assets, debug endpoints or client-side bundles.

---

## 13. Official implementation references (check for current updates)

- Next.js App Router: https://nextjs.org/docs/app
- Next.js installation: https://nextjs.org/docs/app/getting-started/installation
- Supabase SSR authentication: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Cloudflare R2 object uploads / multipart constraints: https://developers.cloudflare.com/r2/objects/upload-objects/
- Cloudflare R2 downloads: https://developers.cloudflare.com/r2/objects/download-objects/
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- AWS SDK for JavaScript v3 multipart upload: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-s3.html

The above documents were checked when this brief was prepared (November 2026). Verify current package APIs and service constraints at implementation time.

---

## 14. Final instructions: what to build first, and how to report back

**Start by implementing Phase 0 and Phase 1 immediately.** Do not begin by building a complex event/academy schema. After Phase 1 works, proceed to Phase 2 and Phase 3 using real service credentials when available, always retaining demo-mode usability.

At each milestone provide:

1. **What changed** — actual filenames/modules and features implemented.
2. **How to run it** — concrete commands and required `.env` entries.
3. **Validation evidence** — commands run and their outcomes; screenshots or local preview if available.
4. **What remains** — blockers that genuinely require the owner's external credentials, art assets, licensed evidence or a deployment account.
5. **Next specific tasks** — no vague “finish backend later”; give precise implementation steps.

### First issue to implement

**`[Frontend] Build the DeadByte landing page with an accessible interactive seven-continent forensic map`**

Acceptance: dark navy/coral cyber style; `DEADBYTE // EVIDENCE ARCHIVE`; `Nothing Deleted. Nothing Forgotten.`; explorer penguin; exact seven-region mapping; pointer/keyboard navigation; mobile cards; routes to region pages; responsive challenge cards with clearly labeled mock content; lint/typecheck/build pass.

### First end-to-end CTF acceptance case

Publish a synthetic **Antarctica / Memory Forensics** challenge named `The Frozen Memory` with a small synthetic evidence archive and known testing-only flag. Register a player, download the actual evidence from the private R2 bucket, submit the flag, grant first-solve points, show the solve on `/profile`, and update `/leaderboard`. Repeat submit should give **zero** additional points. Keep production challenge evidence and flags under the owner's control.

**Remember:** DeadByte should feel like a charming penguin's expedition into a mysterious cyber-forensics archive, but its CTF data, evidence downloads, identity handling and scoring must be genuinely secure and reliable.
