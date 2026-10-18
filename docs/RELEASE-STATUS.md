# Release status · 2026-10-17

Overall: **BLOCKED for public HTTPS acceptance**. The application backend and published source are ready; the public routing and sustained real-model workflow have not passed all release gates.

## Completed

- Source published to `oreyes100/roast-counsel`, branch `main`.
- Application revision `5e08c50917c5550e601096fe26cdd7e68a047572` installed as a dedicated systemd service with external private state.
- Node v22.23.2 on the application host; all 33 tests pass there and locally.
- `/health` returns `{"status":"ok","version":"0.2.0"}`. The service is active and bound only to loopback.
- Nginx configuration validates. Its application vhost returns 401 anonymously and 200 with the owner's dedicated web credentials.
- Authenticated bootstrap selects managed FreeLLMAPI with model `auto`; the unified key is never returned.
- FreeLLMAPI CLI 0.8.1 `setup-claude` completed in a separate `roast-counsel` profile.
- The authenticated gateway model catalog and a minimal real JSON-generation probe succeeded.
- Strict output schemas now define required fields, closed risk enums and the different confidence/score ranges. Invalid outputs remain rejected; the checks were not relaxed to pass a model response.
- No API key, web password, SSH password or session state was committed.

## Remaining gates

The public hostname is not activated on the actual HTTPS frontend. Its current default TLS response is not an acceptable certificate for this release. Administrative access to that frontend is required to add the dedicated vhost and valid certificate; application-host access alone does not authorize a claim that public HTTPS works. Existing NAT and unrelated websites were preserved.

The full synthetic live council did not complete. Its requests exposed provider responses including HTTP 429, 502 and 504; gateway logs also reported Google 503 demand failures and exhausted daily free-model limits on another provider. A successful minimal probe does not establish sustained availability. Retry the synthetic council after upstream availability/quota recovers, without presenting the precalculated demo as AI output.

No automatic recurring deployment or polling job was installed. Retain the documented rollback and private access configuration while the remaining gates are resolved.
