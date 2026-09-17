# G1ftB0x Project Router

This Cloudflare Worker keeps selected projects under canonical G1ftB0x paths while allowing the applications themselves to live on independent Cloudflare Workers.

Current routes:

- `https://www.g1ftb0x.com/signalsafe/` → SignalSafe Worker
- `https://www.g1ftb0x.com/skydex/` → SkyDex Worker
- Equivalent apex-domain routes are included for `g1ftb0x.com`.

The main GitHub Pages site remains the normal origin for all other paths.

SkyDex uses absolute `/assets/...` references in its compiled build, so the router rewrites those references to `/skydex/assets/...` while proxying. SignalSafe is self-contained and needs no asset rewrite.

## Deploy

The Cloudflare zone must already be active and the relevant `www`/apex DNS records must be proxied by Cloudflare. Then deploy with authenticated Wrangler credentials:

```bash
npm install
npx wrangler deploy
```

For CI, keep `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in encrypted secrets rather than committing credentials to this repository.
