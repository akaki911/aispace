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

- **Node.js 20** – matches the runtime configured for the Firebase Functions bundle.
- **npm 9+** – ships with Node 20 and is used for both the web client and Functions workspaces.
- **Firebase CLI** – required for local emulation and deployments (`npm install -g firebase-tools`).

## Installation

1. Install the web client dependencies from the repository root:

   ```bash
   npm install
   ```

2. Install the Firebase Functions dependencies:

   ```bash
   cd functions
   npm install
   ```

   The Functions TypeScript sources are compiled to `functions/lib` via `npm run build` before deployment or emulation.

## Running the AI Space console locally

1. Start the Vite development server from the repository root:

   ```bash
   npm run dev
   ```

   By default the application is served on [http://localhost:5173](http://localhost:5173) and the console shell is mounted under `/admin/ai-developer`. If you need to mount the console elsewhere, set `VITE_AISPACE_BASE` before starting Vite – the helper in `src/index.ts` reads this value to compute the router basename exported as `AISPACE_BASE_PATH`.

2. Open the browser at `http://localhost:5173/admin/ai-developer` (or the path you configured via `VITE_AISPACE_BASE`) to access the panel UI.

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

   Hosting serves the compiled Vite app from `dist/`, while the Functions emulator exposes the API at `/api/...` based on the rewrite rules in `firebase.json`.

## Deploying

1. Build the production bundle:

   ```bash
   npm run build
   ```

2. Deploy both Hosting and Functions to Firebase:

   ```bash
   npm run deploy
   ```

## Optional integrations

The GitHub tree/file/PR endpoints exposed by the Functions app are currently stubbed and return `501` unless the required environment secrets (`GH_PAT` **or** `GH_APP_ID`, `GH_INSTALLATION_ID`, `GH_PRIVATE_KEY`) are provided. Without these values the console still operates, but repository features remain disabled.
