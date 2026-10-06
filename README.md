# Cert Command Center

Personal certification study tracker (React + TypeScript + Vite + Tailwind + Firebase Auth/Firestore/Hosting).
CCNA 200-301 v1.1 first, driven by Jeremy's IT Lab. Certification-agnostic: Security+ or CCNA v2.0 are added as seed data.

Open it and the Dashboard tells you what to study next: today's Anki, lectures and labs for the first incomplete day.

Screens: Dashboard, Study, Roadmap, Labs, Topics, Blueprint, History, Notes, Exam Readiness, Applied at Work, Settings.
Schema: `docs/schema.md`. Blueprint mapping review: `docs/blueprint-mapping-review.md`.

## Local setup
Requires Node 20+ (22 recommended). Java 11+ is only needed for the rules tests.

```bash
npm ci
cp .env.example .env        # or `npm run env:write` once the Firebase web app exists
npm run dev                 # http://localhost:5173
```
Without a `.env` the app shows a "configuration missing" screen instead of a blank page.

### Environment variables (`.env`, gitignored)
| Variable | Meaning |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web app config (public by design; access is enforced by Firestore rules + Auth) |
| `VITE_USE_EMULATORS` | `true` to use the local Auth (9099) and Firestore (8080) emulators |
| `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | Seed script only (never `VITE_`-prefixed, never committed) |

## Firebase setup (once)
Full copy-paste runbook with explanations: `docs/firebase-setup.md`. Summary:
1. `npx firebase login`, then create the project and a web app (`firebase projects:create`, `firebase apps:create web`).
2. Console: Authentication > Sign-in method > enable **Google**. Create the Firestore database (`firebase firestore:databases:create`).
3. `cp .firebaserc.example .firebaserc` (set your project id), `npm run env:write`.
4. `npm run deploy:rules`, then seed (below), then `npm run deploy`.

## Seed (shared reference data)
```bash
npm run seed:dry            # prints what would be written; touches nothing
FIREBASE_PROJECT_ID=<id> npm run seed        # needs Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS
npm run seed -- --prune     # also deletes lessons/labs that were removed from the seed
```
The seed writes only shared collections (certifications, courses, lessons, labs, topics, blueprints, blueprintObjectives,
lessonObjectiveMappings). It never reads or writes `users/**`, so personal progress is untouched by re-seeding.
It also checks referential integrity (every mapping points at a real objective/lesson/item) and fails before writing if not.

## Development, tests, build
| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Pure-logic tests (progress, XP guards, blueprint coverage, topic status) |
| `npm run test:rules` | Firestore security-rule tests against the local emulator (needs Java) |
| `npm run seed:dry` | Seed plan + integrity checks |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run verify` | typecheck + tests + seed dry run + build |
| `npm run emulators` | Local Auth + Firestore emulators (use with `VITE_USE_EMULATORS=true`; seed with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`) |

## Deployment
Manual: `npm run deploy` (build + Hosting). Rules: `npm run deploy:rules`.

Workflow: edit locally, `npm run verify`, commit, `git push`. Pushes to `main` deploy Hosting automatically via
`.github/workflows/deploy.yml` once the one-time setup below is done. Rules and seed data are deliberately **not** auto-deployed:
run `npm run deploy:rules` / `npm run seed` yourself when they change.

### Automatic deploys from GitHub (one-time)
1. Create a service account for deploys (Hosting Admin role is enough): `npx firebase init hosting:github` does this and sets the secret for you, or do it by hand:
   Console > Project settings > Service accounts, generate a key, and paste the JSON into the GitHub secret `FIREBASE_SERVICE_ACCOUNT` (Settings > Secrets and variables > Actions). Never commit the key.
2. Add the five `VITE_FIREBASE_*` values from `.env` as repository **variables** (not secrets; they ship in the browser bundle anyway).
3. Push to `main`. Check the Actions tab.

## Curriculum updates (without losing progress)
Edit files in `seed/` and run `npm run seed`. Progress documents are keyed by stable ids (`ccna-jeremy-day-01`, lecture item ids, lab ids).
Keep existing ids stable; new content gets new ids. Anything unverified stays `null` or carries `reviewFlags`. Use `--prune` only when you intentionally removed days or labs.

## Blueprint versions (e.g. CCNA v2.0)
Blueprints are separate documents keyed by `blueprintId`; nothing in `users/**` references an objective, and coverage is computed from progress + mappings.
To add v2.0 (effective Feb 3, 2027; v1.1 retires Feb 2, 2027):
1. Add a blueprint entry to `seed/blueprints.json` (`ccna-200-301-v2.0`) and its objectives to `seed/blueprint-objectives.json` (ids `ccna-200-301-v2.0__<code>`), from Cisco's official exam-topics PDF.
2. Add mappings to `seed/lesson-objective-mappings.json` (ids `ccna-200-301-v2.0__<itemId>__<code>`), `high` only when the lesson clearly teaches the objective, otherwise `needs_review`.
3. Point `activeBlueprintId` in `seed/certifications.json` at the new blueprint when you switch, then `npm run seed`. v1.1 docs and all progress remain.

Mapping review: mappings marked `needs_review` never count toward coverage. Review them with `docs/blueprint-mapping-review.md`, change `confidence` to `high` and set `reviewed: true`, re-seed.

## Adding Security+ (or another certification)
The data model is certification-scoped (`certificationId` on every lesson, lab, topic, blueprint and progress doc).
1. `seed/certifications.json`: set `security-plus` to `status: active`.
2. Add `seed/<course>-curriculum.json` (same shape as the CCNA file, stable ids, e.g. `secplus-<course>-day-01`), `topics`, blueprint, objectives and mappings files with that certification id.
3. `scripts/seed.ts` currently loads the CCNA curriculum file explicitly; add the new curriculum file to its loader (small change), run `npm run seed:dry`, then `npm run seed`.
4. The certification switcher in the sidebar is display-only in V1; switching the active certification means changing `settings.activeCertificationId`, which needs a small Settings control when a second certification goes live.

## Security notes
- Firestore rules: `users/{uid}/**` owner-only; reference collections read-only to signed-in users; everything else denied. Tested by `npm run test:rules`.
- `.env`, service-account keys, `node_modules`, `dist`, `.firebase` are gitignored.
