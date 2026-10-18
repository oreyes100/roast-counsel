# Release status · 2026-10-17

**Verified:** public HTTPS, authentication, managed FreeLLMAPI `auto`, checkpoint recovery, a completed real synthetic council and real Markdown/JSON exports. The observed gateway60-second cancellation fault has been corrected.

## Deployed correction

Application revision `840056f00eee0fc77d3e6be9af2ec789056d479d` is active. Its FreeLLMAPI deadline is300 seconds across headers and body; other providers retain90 seconds. Both Nginx hops serving FreeLLMAPI now allow360-second read/send timeouts. Each configuration was backed up and passed nginx-t before reload. Existing NAT, unrelated vhosts, gateway keys and auto routing were preserved. The previous application release remains available for rollback.

The old public gateway timeout was60 seconds. Its error logs matched the canceled requests in the owner's analytics. Requests were reaching the gateway; changing credentials or duplicating the/v1 prefix was not the fix. The app already sends authenticated requests to/v1/chat/completions with modelauto.

## Verification

- 38/38 tests passed locally and on the VPS under the service user, including stalled headers/body, explicit cancellation and safe504 messaging.
- Service health and loopback listener remain correct; no owner council was active when the service switched releases.
- Authenticated public HTML/bootstrap return200; managed provider/model remain freellmapi/auto and the key is not returned. Anonymous API access returns401.
- The existing non-demo synthetic council resumed from its saved pending vote and completed in11 total calls, including two earlier failed calls. All9 expected results are saved.
- Actual JSON export confirms COMPLETE/demo=false/modelauto. Markdown and JSON exports return200; no gateway key is present in either.
- Main-site and FreeLLMAPI public HTTPS checks remain200 with valid certificates. The Roast certificate and ACME renewal configuration remain valid.

The final two calls completed in approximately46 seconds combined; this successful run did not itself require a single response longer than the former60-second cutoff. The longer limits are verified from configuration and bounded-timeout regression tests. No claim is made that upstream providers can never fail.

See the [timeout wargame](WARGAME-GATEWAY-TIMEOUT.md), [usage manual](MANUAL-DE-USO.md) and [deployment instructions](DEPLOYMENT.md). Credentials and private operational backups are excluded from Git. No recurring deployment or polling job was installed.
