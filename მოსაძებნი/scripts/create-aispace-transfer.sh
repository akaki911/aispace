#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_NAME="${1:-akaki911-aispace-transfer.zip}"
OUTPUT_PATH="${OUTPUT_NAME/#\/~$HOME}"

cd "$ROOT_DIR"

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: 'zip' command not found. Please install zip before running this script." >&2
  exit 1
fi

INCLUDES=(
  "apps/aispace-web"
  "vite.config.mts"
  "tsconfig.app.json"
  "tsconfig.node.json"
  ".env.example"
  ".gitignore"
  "src/App.tsx"
  "src/AdminPanel.tsx"
  "src/Layout.tsx"
  "src/features/secrets/SecretsAdminPanel.tsx"
  "index.js"
  "functions/src/index.js"
  ".github/workflows/firebase-deploy.yml"
  ".github/workflows/firebase-functions-deploy.yml"
)

EXCLUDES=(
  "apps/aispace-web/tsconfig.app.tsbuildinfo"
  "apps/aispace-web/tsconfig.node.tsbuildinfo"
  "tsconfig.app.tsbuildinfo"
  "tsconfig.node.tsbuildinfo"
)

MISSING=()
ZIP_CONTENTS=()
for path in "${INCLUDES[@]}"; do
  if [ -e "$path" ]; then
    ZIP_CONTENTS+=("$path")
  else
    MISSING+=("$path")
  fi
fi

if [ "${#ZIP_CONTENTS[@]}" -eq 0 ]; then
  echo "Error: None of the requested paths were found. Nothing to archive." >&2
  exit 1
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  printf 'Warning: the following paths were not found and will be skipped:\n' >&2
  printf '  - %s\n' "${MISSING[@]}" >&2
fi

ZIP_ARGS=("-r" "$OUTPUT_PATH")
for exclude in "${EXCLUDES[@]}"; do
  ZIP_ARGS+=("-x" "$exclude")
done

zip "${ZIP_ARGS[@]}" "${ZIP_CONTENTS[@]}"

echo "Archive created at: $OUTPUT_PATH"
