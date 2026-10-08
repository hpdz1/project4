# Package Radar inbound email worker (optional)

A [Cloudflare Email Worker](https://developers.cloudflare.com/email-routing/email-workers/)
that receives the carrier emails users auto-forward to their personal address
(`r-xxxxxxxxxxxxxxxx@<INBOUND_DOMAIN>`), parses them with
[postal-mime](https://github.com/postalsys/postal-mime), and POSTs a small JSON
document to the app:

```
POST <PACKAGE_RADAR_URL>/api/inbound/raw
Authorization: Bearer <INBOUND_SECRET>
Content-Type: application/json

{ "from": "\"UPS\" <mcinfo@ups.com>", "to": ["r-…@mail.example.com"], "cc": [],
  "subject": "…", "text": "…", "html": "…", "headers": [{ "name": "…", "value": "…" }],
  "date": "2026-10-07T15:49:44.000Z" }
```

Attachments and inline `data:` images are never sent (an Informed Delivery digest
with scan images shrinks from megabytes to a few KB), and the app stores only the
shipment facts it extracts, never the email itself.

You don't need this worker if you use Postmark inbound instead (point Postmark's
inbound webhook at `https://postmark:<INBOUND_SECRET>@<your site>/api/inbound/postmark`).

## What happens to each message

| Situation | Worker does | Sender sees |
| --- | --- | --- |
| Recipient can't be an inbound alias (`r-` + 12–32 letters/digits) | `setReject("Unknown recipient")` | Bounce at SMTP time |
| Message larger than `MAX_RAW_BYTES` (default 10 MiB) | Drops it (logged) | Nothing (no bounce) |
| MIME can't be parsed | `setReject("Malformed message")` | Bounce |
| App answers 2xx | Done. If the app says `"status": "unroutable"` (no such account), rejects it | Delivered / bounce |
| App answers 429 or 5xx, times out, or is unreachable | Throws | Temporary failure; the sending server retries |
| App answers any other 4xx (e.g. 401 wrong secret, 400 bad payload) | `setReject(…)` | Bounce |

The app itself answers 200 for well-formed mail it can't route or that is over the
per-address daily limit (300), so those never bounce because of rate limiting.

## Setup

1. **Pick an inbound domain that is the apex of a Cloudflare zone**, e.g.
   `packageradar-mail.com`. Cloudflare Email Routing only supports catch-all rules on
   the apex domain, and every user has their own address, so a catch-all is required.
   (Subdomains only get literal addresses, which doesn't fit per-user aliases.)
   The domain must use Cloudflare DNS.
2. In the Cloudflare dashboard: **Email → Email Routing → Enable**. Cloudflare adds
   its MX, SPF and DKIM records.
3. Configure and deploy the worker:

   ```sh
   cd workers/inbound-email
   npm install                       # postal-mime
   cp wrangler.toml.example wrangler.toml
   # edit PACKAGE_RADAR_URL in wrangler.toml
   npx wrangler secret put INBOUND_SECRET   # paste the same value as the app's INBOUND_SECRET
   npx wrangler deploy
   ```

4. In **Email Routing → Routing rules → Catch-all address**, choose
   **Action: Send to a Worker** and select `package-radar-inbound`. Enable it.
5. In the app's environment set `INBOUND_DOMAIN` to the same domain (e.g.
   `packageradar-mail.com`) and `INBOUND_SECRET` to the same secret, then restart it.
   Inbound routes answer `503 inbound_disabled` until `INBOUND_SECRET` is set.
6. Test: create an account in the app, then send an email to its inbound address.
   It should appear in the worker's logs (`npx wrangler tail`) and in the app's
   dashboard email count.

Generate the secret with something like `openssl rand -base64 32`.

## Limits and costs

- Email Routing inbound is free; messages are capped at 25 MiB by Cloudflare.
- **Workers Free allows only 10 ms of CPU per invocation.** Parsing a typical carrier
  email with postal-mime can take about that long on a cold start, and a large
  Informed Delivery digest more (measured off-platform: 12 ms for a 40 KB UPS email,
  27–48 ms for a 1.4 MB digest). If you see `EXCEEDED_CPU` errors, use the
  Workers Paid plan.
- What Cloudflare does when the worker throws (temporary vs permanent failure) is not
  documented; test on a staging domain before relying on retries.

## Local testing

```sh
printf 'INBOUND_SECRET=dev-secret\n' > .dev.vars
# wrangler.toml: PACKAGE_RADAR_URL = "http://localhost:3000"
npx wrangler dev
curl -X POST 'http://localhost:8787/cdn-cgi/local/email?from=someone@gmail.com&to=r-abcdefghijklmnop@inbound.localhost' \
  --data-binary @sample.eml
```

The `.eml` file must include a `Message-ID` header. Run the app with the same
`INBOUND_SECRET` (and `INBOUND_DOMAIN=inbound.localhost`, the default).
