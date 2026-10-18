# Wargame: gateway requests canceled at 60 seconds

Mission: let managed FreeLLMAPI `auto` complete a bounded slow request and finish a real council without the reverse proxy aborting it prematurely.

Evidence before changes: public gateway Nginx read timeout60s; internal gateway read/send timeout300s; app provider deadline90s. Recent public Nginx errors confirm upstream timeouts at00:01:40,01:40:31,01:50:22 UTC2026-10-18. Gateway analytics supplied by the owner record canceled requests at59954/59997ms. Those requests reached the gateway; a missing `/v1` prefix or absent authentication does not explain these cancellations. The app already posts to `/v1/chat/completions` with modelauto and a Bearer unified key.

Scope: FreeLLMAPI client deadline and its two Nginx hops only; preserve managed auto, credentials, existing sites, sessions, validation rules and bounded attempts. Do not replace real results with a demo or retry generation without counting it.

| Scenario | Expected result |
|---|---|
| Gateway needs more than60/90s | Proxies allow360s idle; app FreeLLMAPI deadline300s permits the response. |
| Other providers | Existing90s app deadline preserved. |
| No headers before app deadline | Request aborts with explicit timeout; checkpoint remains recoverable. |
| Headers arrive but body stalls | Same app deadline covers reading the body. |
| Owner stops during fetch or body | Cancellation remains cancellation, not a model/JSON failure. |
| Gateway returns504 | Safe specific timeout explanation; no provider body/key reflected. |
| Client URL ends in/v1 | Exactly one/v1 prefix; modelauto/Bearer/schema unchanged. |
| Resume old failed session | Completed steps remain saved and are not repeated; remaining attempts/call budget still enforced. |

Gates: focused regression tests; full suite; staged-secret/diff review; nginx-t for each changed proxy before reload; service health and authenticated public bootstrap; slow generation beyond former60s cutoff when observable; complete actual non-demo council and real exports; existing site regression checks. Record unavailable provider capacity separately.

Release/rollback: create private timestamped backups of the two exact FreeLLMAPI vhosts; restore each backup and syntax-check before reload if validation fails. Deploy a separate application release, preserve the previous current pointer and all external session state; roll back that pointer if health/public behavior regresses. Do not restart a council owned by another active session.

Execution log:

- [x] Production identities and timeout chain verified before edits.
- [x] Regression and full tests pass:38/38. The first sandboxed full run could not bind loopback; the authorized run passed all HTTP tests.
- [x] Both proxy read/send timeouts360s validated and reloaded with private backups; no unrelated vhost edits.
- [x] Release840056f0 active, previous5e08c509 retained, no active owner council interrupted; health/authenticated bootstrap and existing sites pass.
- [x] Actual non-demo council resumed and completed with auto:11 total calls including2 historical failures;9 saved results; real Markdown/JSON exports200. Final two calls together took about46s, so no individual post-fix request longer than60s was observed in this run.
