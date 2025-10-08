# SOL-705 Troubleshooting Notes

This document records the investigation performed while addressing the SOL-705 request to resolve NPM 403 errors in the `functions/` package and deploy Firebase Functions to `us-central1`.

## Summary of Actions
- Verified that no project-level `.npmrc` files configure a custom registry or proxy.
- Confirmed the global npm registry is set to `https://registry.npmjs.org/`.
- Cleared the npm cache and removed local proxy settings for the active shell session.
- Attempted to reinstall dependencies within `functions/` using multiple npm workflows.

## Outstanding Issues
Network requests to the NPM registry continue to fail in this environment. When routing traffic through the preconfigured proxy (`http://proxy:8080`), the proxy responds with HTTP 403 for scoped packages such as `@types/express`. Removing the proxy variables results in `ENETUNREACH` errors, so the install cannot complete successfully.

```text
HTTP/1.1 403 Forbidden
curl: (56) CONNECT tunnel failed, response 403
```

Because dependency installation fails, Firebase deployment cannot proceed in this environment. External authentication steps (e.g., `firebase login`) also require network access that is currently unavailable without the blocked proxy.

## Next Steps for Deployment
1. Coordinate with the network administrators to obtain proxy credentials or an allowlist entry that permits outbound HTTPS traffic to `registry.npmjs.org`.
2. Once connectivity is restored, rerun the dependency installation: `npm install --fetch-retries=5 --fetch-retry-maxtimeout=60000`.
3. Build and deploy Firebase Functions with `firebase deploy --only functions --project aispace-prod`.
4. Verify `/api/version` and `/api/ai/health` return HTTP 200 from the hosting domain, ensuring that rewrites target the `api` function in `us-central1`.

These steps should be executed in an environment with working network access to avoid the persistent 403 errors encountered here.
