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
