# Secret scanning remediation guide

GitHub blocks pushes that contain values matching known secret patterns. If you
see an error like **"Push blocked: secret detected"**, follow the steps below to
remove the secret from your history and keep your keys safe.

## 1. Identify what was committed

* Read the secret scanning alert to see the filename and line number.
* Open the file locally and confirm whether a real credential was committed.

## 2. Remove the secret from the repository

* Delete the value from the file or replace it with a placeholder (for example,
  `YOUR_OPENAI_API_KEY`).
* If the file should never contain secrets (such as `.env`), add it to
  `.gitignore` so it is not tracked in future commits.
* Amend the current commit or create a new commit with the cleaned file:

  ```bash
  git commit --amend --no-edit
  # or
  git commit -am "Remove leaked secret"
  ```

* If the secret was committed in earlier history, remove it with
  [`git filter-repo`](https://github.com/newren/git-filter-repo) or the
  [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/).

## 3. Rotate the leaked credential

Even after removing the secret from git, **assume it is compromised**. Revoke it
and generate a new value (for example, create a new OpenAI or Google Cloud API
key). Update the secret in your deployment environment or secret manager.

## 4. Force-push if necessary

If you rewrote history, push with `--force-with-lease` to update the remote:

```bash
git push --force-with-lease
```

This is safe as long as you coordinate with other collaborators who may have
based work on the old commits.

## 5. Use environment-specific secret storage

* Keep production credentials in your hosting provider's secret manager (for
  example, Firebase Functions secrets or GitHub Actions secrets).
* For local development, store them in an untracked `.env.local` file.
* Never commit real credentials into `.env.example`; it should only contain
  placeholders.

Following these steps resolves the GitHub Desktop warning and prevents future
secret leaks.
