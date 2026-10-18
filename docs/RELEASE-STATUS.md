# Release status · 2026-10-17

Public HTTPS is **verified and operational**. Full live-AI acceptance remains **incomplete** after a gateway HTTP 502 during the third round. The hosted UI must not be described as an end-to-end approved AI council yet.

## Completed

- Source published to `oreyes100/roast-counsel`, branch `main`.
- Application revision `5e08c50917c5550e601096fe26cdd7e68a047572` installed as a dedicated systemd service with private external state.
- Node v22.23.2 on the application host; all 33 tests pass there and locally for the deployed source revision.
- Service health is correct and its Node listener remains bound only to loopback.
- Public `https://roast.dineroorganizado.duckdns.org/` validates with strict TLS. Anonymous requests return 401; authenticated HTML and bootstrap return 200.
- The certificate covers the exact hostname and expires on 2027-01-15 at 23:35:31 UTC. ACME renewal cron and Nginx reload hook are configured.
- Authenticated JavaScript, CSS, icon, jsPDF and attribution assets return 200.
- Bootstrap selects managed FreeLLMAPI/model `auto`; the unified key is never returned. The gateway chooses the underlying model per request.
- FreeLLMAPI CLI 0.8.1 setup completed in the separate `roast-counsel` Claude profile, now also using `auto`.
- A minimal real JSON-generation probe succeeded. The latest public synthetic council produced validated real responses through the first two rounds and draft, before failing in round three.
- Existing main-site and FreeLLMAPI HTTPS checks returned 200. Existing NAT and unrelated sites were preserved.
- Proxy access was verified using the operator's supplied connection guide and host fingerprints. The working route uses an existing key on the application VM. The vhost and valid certificate were already present at that point; this continuation verified them without modifying the proxy configuration.
- No API key, web password, SSH password or session state was committed.

## Remaining gate

The latest non-demo synthetic council used seven calls and failed in round three with HTTP 502 from the gateway. No completed real verdict or its exports have been verified. Earlier attempts also encountered provider 429/502/504 and demand/quota conditions. Resume the saved checkpoint when service availability recovers, within its bounded attempt budget, or start a new synthetic council after correcting the cause. Keep `auto`; do not substitute precalculated demo output for a real result.

A further gateway-log inspection was not executed because automatic approval review could not complete due to a usage limit. No new cause is inferred from logs that were not read.

No recurring deployment or polling job was installed. Use the [usage manual](MANUAL-DE-USO.md) and [deployment instructions](DEPLOYMENT.md). Owner access credentials are kept only in a separate private handover excluded from Git.
