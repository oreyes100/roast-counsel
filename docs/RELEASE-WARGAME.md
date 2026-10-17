# Release wargame: FreeLLMAPI and hosted webapp

Mission: publish this app as a private authenticated website, connect the configured FreeLLMAPI gateway, and ship the same reviewed revision to GitHub and the application server.

Boundaries: preserve existing websites; never publish credentials, SSH topology or sessions; no changes to unrelated model defaults. Use the standalone repository, a dedicated service, private external state directory and loopback-only app socket.

| Scenario | Expected result | Verification |
|---|---|---|
| Unified key configured | Server makes real JSON calls through the HTTPS gateway | Tiny live probe and synthetic council |
| Browser attempts key replacement | Managed endpoint rejects modification | Server contract test |
| Forged origin/host or untrusted forwarded header | Mutation rejected unless exact configured origin and CSRF token match | HTTP integration tests |
| Wrong-source citation, incomplete score or missing vote | Incomplete result cannot become a completed verdict | Domain/engine tests |
| Budget exhaustion, provider outage or process restart | Private checkpoints preserved; bounded manual recovery | Engine integration tests |
| Public anonymous visitor | Cannot view sessions, trigger AI or fetch the app | HTTPS access check returns 401 |
| Authenticated owner | Can load app, bootstrap model and create a council | HTTPS and browser checks |
| New host has no TLS route | Do not claim public deployment complete | Validate certificate hostname, validity and proxy route |
| Git staging includes private state | Release blocks before commit | Secret scan, tracked-file review and ignore checks |
| Deployment regression | Stop only the new service or revert its release pointer | Dedicated service and documented rollback |

Release gates: test suite green; gateway probe and synthetic live council complete; reviewed public source with no secrets; GitHub commit pushed; service healthy and loopback-bound; authenticated public HTTPS works with a valid certificate; existing sites remain healthy. Record blockers honestly rather than accepting a partially routed website.
