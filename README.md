# Cert Command Center

Personal certification study app (React + TypeScript + Tailwind + Firebase). CCNA 200-301 v1.1 first,
driven by Jeremy's IT Lab; certification-agnostic so Security+ or CCNA v2.0 are added as seed data.

## Status (Stage 1)
Working: Google sign-in, app shell/navigation, dark dashboard, Roadmap, Daily Study session flow
(saves session, lesson/lab progress, XP, totals), Settings (weekly goal), seed/import script, Firestore rules.
Placeholders: Labs, Topics, Blueprint, History, Notes, Exam Readiness, Applied at Work.

## Setup
1. `npm install`
2. Create a Firebase project; enable **Authentication > Google** and **Firestore**.
3. `cp .env.example .env` and fill the web app config. `cp .firebaserc.example .firebaserc`.
4. Seed reference data (one time, then after any seed change):
   - Create a service account key (Project settings > Service accounts), save as `serviceAccount.json` (gitignored).
   - `FIREBASE_PROJECT_ID=<id> GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json npm run seed`
   - `npm run seed:dry` prints what would be written. `-- --prune` removes lessons/labs dropped from the seed.
5. `firebase deploy --only firestore:rules`, then `npm run dev`.

## Curriculum updates without losing progress
Edit files in `seed/` and re-run `npm run seed`. The script only writes shared reference collections and
never touches `users/**`. Progress docs are keyed by stable lesson/lab ids (e.g. `ccna-jeremy-day-01`), so
keep ids stable; new days get new ids. Items that could not be verified are `null` or carry `reviewFlags`.

## Deploy
`npm run build && firebase deploy --only hosting`. GitHub: `git init && git add . && git commit -m "Initial commit"`,
create an empty repo, `git remote add origin <url> && git push -u origin main`. `.env` and service account keys are gitignored.

## Tests / checks
`npm run typecheck`, `npm test` (progress logic), `npm run seed:dry`. Firestore rules tests are planned for Stage 4.
Schema: `docs/schema.md`.
