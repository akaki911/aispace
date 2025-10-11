# AGENTS.md — Repo Operations Guide

> This AGENTS.md was synced from Admin → AI Developer → Settings on 2025-10-07T06:55:31Z. Admin UI is the primary editable surface; this file mirrors those rules plus repository defaults.

## Purpose & Scope
- These guidelines apply to the entire repository unless a more deeply nested `AGENTS.md` overrides them.
- Always obey the active system, developer, and direct user prompts even when they conflict with this file.
- When touching files, check for nested `AGENTS.md` files inside their directories and follow the most specific rules found.

## Git Rules
- Work on the current branch only; do not create or switch to new branches.
- Create new commits instead of amending or rewriting history; never modify existing commits.
- Ensure the working tree is clean before finishing, with no staged or unstaged changes and no untracked files left behind.
- Run any configured `pre-commit` hooks and fix issues they report before committing.
- Each task must end with exactly one commit capturing all changes.

**(Repository defaults):**
- Aim to deliver the task in a single commit; if `pre-commit` or similar tools auto-fix files, up to three follow-up commits are acceptable.
- Do not leave generated artifacts, temporary files, or untracked content in the worktree when handing off the task.

## Programmatic Checks
- After implementing changes and before committing, run all required programmatic checks listed in this document.
- If a check fails, resolve the issue and re-run the check until it passes.
- If a requested check is unavailable (script missing, service absent, etc.), note the skip and the reason in the PR message.

## Coding Conventions
- Follow existing project coding styles for each language and framework; when uncertain, match the surrounding code.
- Do not wrap import statements in `try/catch` blocks.
- Keep diffs minimal and avoid unrelated refactors.

**(Repository defaults):**
- Prefer running linting or formatting scripts with `--fix`/`--write` flags when they are available to resolve issues automatically.
- Avoid adding new `try/catch` guards around module imports; let bundlers or runtimes surface failures naturally.

## Environment & Tooling *(Repository defaults)*
- Use Node.js versions compatible with the repository’s engines field (`>=18 <=22` from `package.json`); default to the latest LTS release when unsure.
- Use `npm` as the package manager. Prefer `npm ci` over `npm install` for reproducible installs in CI or scripted environments.
- For monorepo-style workspaces, execute commands within the relevant package directory or use `npm -w <package> run <script>` to target the correct workspace.
- Confirm required CLIs or services (Firebase, Vite, etc.) are available before running dependent scripts; document any missing tooling.

## Testing Commands
- **Root:** Run `npm run lint` and any other relevant root-level test scripts when they exist.
- **/backend:** Run `npm install` if needed, then execute `npm run lint` when defined and `npm test` for unit coverage.
- **/ai-service:** Run `npm run lint` and `npm test` when available. After backend tests pass, smoke-test the service locally with quick `curl` calls to `/health` and `/api/ai/health` if the service can be started within the task scope.
- **/frontend:** Run `npm run lint`, `npm run type-check`, and `npm run build` when those scripts are defined. Ensure UI-affecting changes build successfully.
- Codex must auto-detect whether each script exists before running it; skip missing scripts with an explanatory note in the PR message.

**(Repository defaults):**
- Use `npm run lint --if-present`, `npm run test --if-present`, and similar guards so missing scripts are skipped gracefully.
- Example command sets:
  - **Root:** `npm run lint --if-present`
  - **/backend:** `npm ci` (when dependency installation is required), `npm run lint --if-present`, `npm test --if-present`
  - **/ai-service:** `npm run lint --if-present`, `npm test --if-present`; smoke check if service is running: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5001/health` → expect `200`, and `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5001/api/ai/health` → expect `200`
  - **/frontend:** `npm run lint --if-present`, `npm run type-check --if-present`, `npm run build --if-present`
- Document skipped checks in commit/PR notes, including the reason (missing script, service offline, etc.).

## Rate-limit & Retry *(Repository defaults)*
- Serialize health or status polling commands to avoid overwhelming services.
- On HTTP `429` or `5xx` responses, retry up to three times with a 5-second exponential backoff between attempts.
- Record any retries performed (count and reason) in the PR message when relevant.

## PR Message Template
- **Title:** Provide a short, descriptive summary.
- **Body Sections:**
  - **What changed:** Bullet list of key updates.
  - **Why:** Brief rationale for the change.
  - **Risks:** Potential impacts or confirm low risk.
  - **Testing:** Enumerate commands run and their outcomes, mentioning any skipped checks and why.
  - **Touched paths:** List every file path changed.

**(Repository defaults):**
- Use Conventional Commits style titles when possible (e.g., `feat:`, `fix:`, `docs:`) to clarify intent.

## Citations
- Summaries in assistant responses must cite code or documentation using the format `【F:<path>†Lstart(-Lend)?】`.
- Reference terminal commands with `【<chunk_id>†Lstart(-Lend)?】` when those outputs substantiate a claim.

## Precedence / Safety & Secrets / Short-on-time Clause
- Instruction priority: direct system or developer prompts > latest user prompt > deepest `AGENTS.md` > ancestor `AGENTS.md`.
- Never expose secrets, API keys, or credentials in source code, logs, commits, or PR descriptions.
- If a user explicitly states they are short on time, you may skip long-running checks. Document exactly which checks were skipped and why.
