# Feature Flags

This document tracks the feature flags that gate administrative tooling. Flags are sourced from the Vite runtime (`import.meta.env`).

| Flag | Environment Variable | Default | Description | Related routes |
| --- | --- | --- | --- | --- |
| `GITHUB` | `VITE_GITHUB_ENABLED` | `0` (disabled) | Controls the GitHub management workspace. When disabled, the GitHub menu shows a locked placeholder instead of loading heavy GitOps tooling. | `/admin/github`, `AI Developer → GitHub` |
| `AI` | `VITE_AI_ENABLED` | `0` (disabled) | Enables access to the AI Space developer tooling, including the AI Developer panel and experiment routes. | `AI Developer → *` |
| `BROWSER_TESTING` | `VITE_FEATURE_BROWSER_TESTING` | `0` | Enables the automated browser testing dashboard for super admins. | `/admin/browser-testing` |
| `CONNECTORS` | `VITE_FEATURE_CONNECTORS` | `0` | Toggles the integration connector manager UI. | `/admin/connectors` |
| `SECRETS` | `VITE_FEATURE_SECRETS` | `0` | Enables the secrets manager UI for storing sensitive credentials. | `/admin/secrets` |

To enable a flag locally update your `.env` or `.env.local` file and restart the dev server.
