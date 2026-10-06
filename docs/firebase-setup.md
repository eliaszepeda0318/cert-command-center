# Firebase setup runbook

Run these in a normal Terminal on your Mac, from the project folder. Prerequisites: Node 20+ (`node -v`). Nothing here needs a billing plan (Spark/free tier covers Auth, Firestore and Hosting at personal scale).

## 1. Sign in and create the project
```bash
npm ci
npx firebase login                      # opens the browser; approve with your Google account
npx firebase projects:create <project-id> --display-name "Cert Command Center"
npx firebase apps:create web "Cert Command Center" --project <project-id>
cp .firebaserc.example .firebaserc      # then edit: set "default" to <project-id>
npm run env:write                       # writes .env from the web app config (gitignored)
```
`<project-id>` must be globally unique, lowercase, e.g. `cert-command-center-eli`.

## 2. Enable Google sign-in (Console, one click-through)
Firebase Console > your project > Authentication > Get started > Sign-in method > Google > Enable, choose a support email, Save.
Authorized domains already include `localhost` and `<project-id>.web.app` / `.firebaseapp.com`; add a custom domain here later if you use one.

## 3. Create Firestore and deploy rules
The database location cannot be changed later. Los Angeles is `us-west2`.
```bash
npx firebase firestore:databases:create "(default)" --location us-west2 --project <project-id>
npm run deploy:rules
```

## 4. Seed reference data
Use your own Google login (no key file):
```bash
brew install --cask google-cloud-sdk    # skip if gcloud exists
gcloud auth application-default login
gcloud auth application-default set-quota-project <project-id>
FIREBASE_PROJECT_ID=<project-id> npm run seed
```
(Alternative: Console > Project settings > Service accounts > Generate key, save it OUTSIDE the repo, and set `GOOGLE_APPLICATION_CREDENTIALS` to its path. Delete it afterwards.)

## 5. Verify locally, then deploy
```bash
npm run dev            # sign in with Google, open Study, save a session
npm run test:rules     # needs Java 11+ (`brew install openjdk`)
npm run deploy         # build + Hosting
```
The live URL is `https://<project-id>.web.app`.
