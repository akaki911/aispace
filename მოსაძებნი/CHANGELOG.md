# Changelog

## Unreleased
- Extracted Auto Improve metrics and monitor data fetching into reusable hooks and centralized metric tone constants.
- Restored the GitHub menu above Backup in the AI Developer sidebar and show a clear OFF badge when disabled.
- Added a flag-aware `/admin/github` route that lazy-loads the GitHub management hub or a safe placeholder page.
- Removed the unused `AutoImproveMetricsPanel` component to prevent dead code from drifting in the dashboard bundle.
