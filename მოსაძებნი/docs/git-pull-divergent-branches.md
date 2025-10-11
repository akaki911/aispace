# Handling "Need to specify how to reconcile divergent branches" During `git pull`

When you run `git pull` and Git detects that your local branch and the remote branch have diverged, it needs to know how to combine the histories. If no default strategy is configured, Git shows the following message and aborts the pull:

```
You have divergent branches and need to specify how to reconcile them.
```

To continue, pick one of the strategies below. You only need to set this once per repository (or set it globally for all your repositories).

## Option 1: Merge (default behavior)

```bash
git config pull.rebase false
```

This tells Git to merge the remote changes into your local branch when you run `git pull`.

## Option 2: Rebase (linear history)

```bash
git config pull.rebase true
```

This instructs Git to rebase your local commits on top of the remote branch when pulling, giving you a linear history.

## Option 3: Fast-forward only (fail if merge is needed)

```bash
git config pull.ff only
```

With this option, `git pull` will only succeed if your branch can be fast-forwarded. Otherwise, it aborts.

### Apply the configuration globally (optional)

If you want the chosen behavior to apply to every repository on your machine, add the `--global` flag, for example:

```bash
git config --global pull.rebase true
```

### One-off pulls

You can also specify the behavior directly on a single `git pull` command without saving it as a configuration:

```bash
git pull --rebase       # rebase for this pull only
# or
git pull --no-rebase    # merge for this pull only
```

Pick the strategy that matches your workflow. If you're unsure, the merge option (`git config pull.rebase false`) is the safest choice.
