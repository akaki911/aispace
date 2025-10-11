# AISpace Asset Transfer Guide

This guide describes how to package the requested AISpace assets into a single archive without committing a binary file to the repository.

## Prerequisites
- Bash-compatible shell
- [`zip`](https://linux.die.net/man/1/zip) CLI available in your environment

## Usage
Run the helper script from the repository root:

```bash
./scripts/create-aispace-transfer.sh
```

By default this creates `akaki911-aispace-transfer.zip` in the current directory. Provide a different filename (or absolute path) as an argument if desired:

```bash
./scripts/create-aispace-transfer.sh /tmp/custom-aispace-assets.zip
```

## Included Paths
The script bundles the following resources when present:

- `apps/aispace-web/`
- `vite.config.mts`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `.env.example`
- `.gitignore`
- `src/App.tsx`
- `src/AdminPanel.tsx`
- `src/Layout.tsx`
- `src/features/secrets/SecretsAdminPanel.tsx`
- `index.js`
- `functions/src/index.js`
- `.github/workflows/firebase-deploy.yml`
- `.github/workflows/firebase-functions-deploy.yml`

The following build artifacts are automatically excluded if present:

- `apps/aispace-web/tsconfig.app.tsbuildinfo`
- `apps/aispace-web/tsconfig.node.tsbuildinfo`
- `tsconfig.app.tsbuildinfo`
- `tsconfig.node.tsbuildinfo`

## Missing Files
If any listed paths are absent, the script will continue and print a warning so you can verify the archive contents before sharing it.
