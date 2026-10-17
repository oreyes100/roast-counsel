# Deployment

Intended public URL: https://roast.dineroorganizado.duckdns.org/

The application server uses the included systemd unit, a dedicated unprivileged `roast-counsel` account and a loopback listener on port 4730. Source releases live under `/opt/roast-counsel/releases/<commit>`; `current` points to the active revision. Runtime sessions live separately in `/var/lib/roast-counsel/sessions` and never enter Git.

Configuration belongs in `/etc/roast-counsel.env` (root-owned, mode 0600): `FREELLMAPI_URL`, `FREELLMAPI_API_KEY`, `FREELLMAPI_MODEL=auto`, `PUBLIC_ORIGIN`, `ROAST_DATA_DIR`, `ROAST_CONFIG_LOCKED=true` and `PORT`. The unified key is provided only through the service environment. The frontend cannot retrieve or replace it.

Use a valid HTTPS certificate on the public reverse proxy. The application Nginx vhost requires HTTP Basic authentication for every route, including static assets, sessions, model configuration and AI execution. Keep its password file outside the checkout with restricted permissions. Never reuse SSH passwords as web credentials. Do not expose the bare Node listener to the Internet.

Templates are in `deploy/`. Substitute the approved domain and private upstream address outside Git. Check `nginx -t` before reloading only the relevant proxy. Preserve all existing vhosts. `PUBLIC_ORIGIN` must exactly match the externally visible HTTPS origin; forwarded headers do not authorize arbitrary origins.

Verification gates:

- `npm test` passes on the release checkout.
- `systemctl is-active roast-counsel` returns `active`.
- `curl http://127.0.0.1:4730/health` returns status `ok` on the application host.
- The listening socket is bound to loopback.
- An anonymous request to the public HTTPS site returns 401.
- An authenticated request returns the app and a managed FreeLLMAPI bootstrap without exposing the key.
- A synthetic live council completes without being marked as a demo.
- The TLS certificate is trusted, valid for the public hostname and not expired. Existing applications retain their prior health behavior.

Rollback of this new installation: stop/disable `roast-counsel`, remove only its new Nginx vhost symlink, run `nginx -t`, then reload Nginx. Preserve private sessions and the environment file for recovery. For a later update, point `current` back to the previous recorded release and restart only this service. Never reset or delete unrelated sites.

Private SSH topology, access passwords and API keys are deliberately excluded from this repository. Public HTTPS activation is complete only after the certificate and frontend routing gates pass; an internal healthy backend alone is not sufficient.
