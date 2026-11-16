# Picks service

A small service that saves visitors' picks on the volunteer page and gives back a tally of what other visitors said. It stores one line per pick: the place, the pick, the time to the minute, and a random visit code made up by the browser. Nothing personal is stored.

It is built and tested, and not deployed: the live page has saving switched off (`PICKS_URL = ''` in `../site/app.js`), so it saves nothing.

- `server.cjs`: the service. Node.js only, no packages. It listens on 127.0.0.1 only; settings are environment variables listed at the top of the file.
- `test_picks.cjs`: its checks. Run `node volunteer/picks_server/test_picks.cjs` from the top folder of the repository; it starts the service on a free local port and ends with `35 passed, 0 failed`.

To deploy it: the tally is "what visitors said", not a vote. The brakes are a per-device rate limit and a size cap, so a script can still stuff it; add moderation, and check what rules a public site needs for young visitors.
