# Picks service: NOT DEPLOYED

**This service was built and tested, but it is not running anywhere.** The volunteer page has saving switched off (`PICKS_URL = ''` in `../site/app.js`), so the live page saves nothing.

What it would do: store one line per pick (the place, the pick, the time to the minute, and a random visit code made up by the browser) and give back a tally of what other visitors said. Nothing personal is stored.

- `server.cjs`: the service. Node.js only, no packages. It listens on 127.0.0.1 only; settings are environment variables listed at the top of the file.
- `test_picks.cjs`: its checks. Run `node volunteer/picks_server/test_picks.cjs` from the top folder of the repository; it starts the service on a free local port and ends with `35 passed, 0 failed`.

Before anyone deploys it: the tally is "what visitors said", not a vote. A script can stuff it (the brakes are a per-device rate limit and a size cap), there is no moderation, and whether a public site needs further rules for young visitors was not researched.
