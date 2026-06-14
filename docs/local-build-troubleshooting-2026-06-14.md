# Local Build Troubleshooting - 2026-06-14

## Symptom

On the Windows workstation, `npm run build:web` timed out after 4 minutes and stopped after printing only:

```text
▲ Next.js 15.5.18
```

The build did not reach `Creating an optimized production build ...`.

## Finding

- Local `node -v`: `v24.12.0`
- CI/deploy Node version: `20.19.x`
- CI runtime: `20.19.x`
- Windows local runtime expectation after this fix: Node `20.19.x`
- Re-running with `NEXT_TELEMETRY_DISABLED=1` and `CI=1` still hung at the same Next.js banner, so telemetry/network startup was not the likely cause.

## Resolution

The repository now fails fast on Windows when dev/build/start/install commands run under a Node version that is known to hang this local Next.js build.

Use Node 20.19.x locally:

```powershell
nvm install 20.19.0
nvm use 20.19.0
node -v
npm ci
npm run build:web
```

The repo includes both `.nvmrc` and `.node-version` for common Node version managers. Linux deploys should still prefer Node 20.19.x to match CI, but the guard is intentionally focused on the Windows failure mode observed here.

## Notes

- The previous failure mode was a silent local hang under Node 24.
- Production deploys and GitHub CI already use Node 20.19.x, and production validation passed after the SEO slug fixes.
- If build time remains high after switching to Node 20.19.x, rerun with `npm run clean:build` first, then capture the first stage where `next build` slows down.
