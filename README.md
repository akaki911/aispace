# aispace
Independent AI control space for Gurulo Assistant, connected to the Bakhmaro platform.

## Project structure

The repository is now organised around a single front-end application that lives in `src/` and the Firebase Cloud Functions code that lives in `functions/`:

```
├── src/                   # Vite + React application
│   ├── components/        # UI building blocks for the AI developer console
│   ├── hooks/             # Reusable application hooks
│   ├── routes/            # Route definitions for the console shell
│   ├── services/          # API client helpers
│   ├── store/             # Local state helpers and utilities
│   ├── theme/             # Theme tokens and helpers
│   ├── types/             # Shared TypeScript types
│   ├── App.tsx            # Entry component for the routed console UI
│   ├── index.ts           # Re-exports for external embedding
│   └── main.tsx           # Browser entry-point consumed by Vite
├── functions/             # Firebase Functions source (TypeScript)
└── index.html             # Vite HTML entry file
```

All legacy root-level React components and duplicate Vite configuration files have been removed so that the repository only contains the sources that are actively used by the application.

## Requirements

Install the following tooling before working with the repository:

- **Node.js 20** – matches the runtime configured for the Firebase Functions bundle. Use a version manager such as `nvm` to pin the runtime.
- **npm 9+** – bundled with Node 20 and used for both the Vite client and the Functions workspace.
- **Firebase CLI** – required for local emulation and deployments (`npm install -g firebase-tools`). Run `firebase login` once to link your Google account.
- **Git** – used for cloning the repository and pushing deployment automation changes.

## Installation

1. Clone the repository and move into the project root:

   ```bash
   git clone <your-fork-url> aispace
   cd aispace
   ```

2. Install the web client dependencies from the repository root:

   ```bash
   npm install
   ```

3. Install the Firebase Functions dependencies:

   ```bash
   npm --prefix functions install
   ```

   The Functions TypeScript sources are compiled to `functions/lib` via `npm run build` before deployment or emulation.

## Environment configuration

Create a `.env` file in the project root (Vite automatically loads it) with the values needed for your installation:

```
VITE_AISPACE_BASE=/admin/ai-developer
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
```

Additional secrets for GitHub integrations are described in [GitHub integration secrets](#github-integration-secrets). Never commit the `.env` file to source control.

> **Secret scanning tip:** If GitHub Desktop blocks a push with "secret detected",
> follow the workflow in [docs/SECRET_SCANNING.md](docs/SECRET_SCANNING.md) to
> remove the value from history, rotate the credential, and force-push the
> cleaned branch.

## Running the AI Space console locally

1. Start the Vite development server from the repository root:

   ```bash
   npm run dev
   ```

   By default the application is served on [http://localhost:5173](http://localhost:5173) and the console shell is mounted under `/admin/ai-developer`. If you need to mount the console elsewhere, set `VITE_AISPACE_BASE` before starting Vite – the helper in `src/index.ts` reads this value to compute the router basename exported as `AISPACE_BASE_PATH`.

2. If you want API calls to resolve against the local emulator, ensure the Firebase emulators are running (see [Emulating the backend API locally](#emulating-the-backend-api-locally)).

3. Open the browser at `http://localhost:5173/admin/ai-developer` (or the path you configured via `VITE_AISPACE_BASE`) to access the panel UI.

## Emulating the backend API locally

The Functions package exposes an Express app with health/version endpoints and placeholders for GitHub integrations (`functions/src/index.ts`). To test it locally:

1. Build the TypeScript sources (or run them in watch mode):

   ```bash
   npm --prefix functions run build
   # or: npm --prefix functions run watch
   ```

2. In another terminal, launch the Firebase emulators for Hosting and Functions:

   ```bash
   npm run emulate
   ```

   Hosting serves the compiled Vite app from `dist/`, while the Functions emulator exposes the API at `/api/...` based on the rewrite rules in `firebase.json`. Use `CTRL+C` to stop the emulators when you finish testing.

## Deploying

1. Build the production bundle:

   ```bash
   npm run build
   ```

   This command runs Vite in production mode and generates the assets inside `dist/`.

2. Deploy both Hosting and Functions to Firebase:

   ```bash
   npm run deploy
   ```

   The script executes `firebase deploy --only hosting,functions` using the project configured in `.firebaserc`. Ensure you are authenticated with the Firebase CLI and have access to the target project.

3. (Optional) Deploy only Functions after making API changes:

   ```bash
   npm run deploy:functions
   ```

4. (Optional) Deploy only Hosting after front-end updates:

   ```bash
   npm run deploy:hosting
   ```

## GitHub integration secrets

The GitHub tree/file/PR endpoints exposed by the Functions app are currently stubbed and return `501` unless secrets are provided. Choose one of the following authentication strategies:

### Personal access token

Set a classic or fine-grained personal access token with repository scope as an environment variable when running the Functions emulator or deploying:

```
GH_PAT=<token-value>
```

### GitHub App credentials

Provide the credentials emitted by your GitHub App installation:

```
GH_APP_ID=<numeric-app-id>
GH_INSTALLATION_ID=<numeric-installation-id>
GH_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

For local development, export the values in your shell before launching the emulators or add them to `.env.local` inside the `functions/` directory. For deployed Functions, configure the secrets via `firebase functions:secrets:set` so they are available at runtime. Without these values the console still operates, but repository features remain disabled.
