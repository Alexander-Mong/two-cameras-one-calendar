# Fire record connector: ask your own AI

A small connector that lets the AI chat app you already use answer "Is this place burning more than usual?" for any of 235 countries and territories, from NASA's FIRMS satellite fire detections, with the older MODIS camera (since 2000) and the newer VIIRS camera (since 2012) put on one scale. It speaks the Model Context Protocol (MCP), the standard way chat apps plug in outside tools, and answers with the same sentences as our web page: the verdict in plain words, how it compares with the usual for those dates, and MODIS's own answer when the two cameras disagree. It also reaches NASA directly for what its satellites saw in the last 24 hours to 7 days, so "is it burning right now, and is that normal?" gets one answer. It runs on your own computer, needs no account or key, and goes online only to fetch NASA's recent files.

**AI use:** this connector's code and tests were written with AI coding assistants (Claude, through Claude Code) and reviewed for faults by a second AI model family (OpenAI's, through the Codex command-line tool). Directed and reviewed by the team, Spark Squad. Full statement: [../AI_USE.md](../AI_USE.md).

## What you need
Node.js 20 or newer (from nodejs.org). Nothing else: no packages to install, no sign-up. The folder is about 6 MB, data included. The 26-year record works offline; the "right now" answers need an internet connection to NASA's FIRMS site.

## Add it to your chat app
Put this folder anywhere on your computer. Below, `<where you put this folder>` means its full path, as your file manager shows it.

**Claude desktop app.** Settings, Developer, Edit Config. In the file that opens, add this inside the outer braces (merge it into `mcpServers` if that is already there), save, and restart the app:
```json
"mcpServers": {
  "fire-record": {
    "command": "node",
    "args": ["<where you put this folder>/server/server.cjs"]
  }
}
```
If the app says it cannot find `node`, put the full path to Node instead (`where node` on Windows, `which node` on a Mac or Linux prints it). On Windows, write every backslash in the path twice inside the JSON, or use forward slashes instead.

**Claude Code.** In a terminal: `claude mcp add fire-record -- node "<where you put this folder>/server/server.cjs"`

**Other chat apps** that take local MCP servers need the same two things: the command `node` and the argument `<where you put this folder>/server/server.cjs`. Check that it works without a chat app: `node test/run_tests.cjs` (from this folder) should end with `0 FAIL`.

**Or use the hosted one** (nothing to install): add `dashboard.alexmong.com/spaceapps-connector/mcp`, with https in front, as a custom connector in your chat app's settings.

## Five things to ask
1. "Is Argentina burning right now?"
2. "How bad were the fires in Australia in December 2019?"
3. "Will Argentina have a bad fire season next year?"
4. "Show me Greece's fire record year by year."
5. "Give me a sentence about fire in Argentina for an article."

The answer to the second, as the connector gives it today: "Australia's December 2019 was far busier than normal, with about three times the usual amount of fire. That's about 13,000 fire detections in December 2019." Then one next question: "Want the rest of 2019 month by month?" More in `EXAMPLES.md`.

## What it offers
Eleven tools your chat app can call. `fire_now` answers "is it burning right now?": NASA's file labeled 24h together with the 26-year record's answer for the same place. The record: `fire_answer` (the answer for a place and period: the latest month, this year, the last fire season, a year or a month; a season also lists each of its months; a future period gets the patterns to watch), `place_record` (every year since 2000, with, from 2022, what a plain unadjusted join of the two cameras would wrongly show; or one year month by month), `how_sure` (how far our joined record holds up in that country), `report_sentence` (a sentence for a report), `find_places` (search the 235 places) and `compare` (two places, or two periods of one place). `viirs_scale` reads a year or month on the newer VIIRS camera's scale ("what would VIIRS have counted in 2005?"): an estimate before 2012, with VIIRS's own count beside it from 2012 on. Straight from NASA, not put on one scale: `nasa_recent` (the last 24 hours, 48 hours or 7 days for a country or a box of latitude and longitude), `nasa_archive` (chosen dates; needs your own free NASA map key, set as `FIRMS_MAP_KEY`; without one it says how to get one) and `nasa_sources` (what NASA data it reaches, and NASA's own caution). Each returns a short answer in plain words, the numbers behind it, and one next question.

## How it talks
- **A sentence that is the answer, first.** "Australia's December 2019 was far busier than normal." "Greece had hardly any fire in December 2025." Fires are fires.
- **One number worth remembering,** rounded; every number is in the structured result for anyone who asks. A year or season also comes as a strip of bars (`J F M A M J J A S O N D` over `▁▂▃▄▅▆▇█`).
- **One next question at the end,** chosen from the data ("Want to know why the two cameras split here?").
- **One qualifier, only when it changes the answer:** the two cameras disagree, the numbers are early data from NASA's rapid feed, or our record is weak for that country (then MODIS's own count leads).
- **The future:** "Will it be a bad season?" gets the patterns to watch, from the record: when the season runs and peaks, how this year and the last season compare with usual, and what the big years looked like. Never a number or a verdict for a date that hasn't happened.
- **Right now, on the ground:** for what to do or where to go, local authorities and emergency services. NASA itself advises against using these data for decisions on the ground.
- **The numbers:** a detection is one 5 km patch of ground where a satellite saw fire on one day, so one big fire counts many times (said once in a conversation, not in every answer). The record's data are the files in this folder: most places through December 2025, Argentina through November 12, 2026.

## How the numbers were made
NASA's FIRMS archive lists every satellite fire detection; we counted them into 5 km squares per day for each country, month by month, from November 2000. The newer VIIRS camera sees far more small fires than MODIS, so gluing the two records together would make recent years look like a sudden explosion of fire; our engine instead translates the VIIRS months onto MODIS's scale, country by country, using the years both cameras flew (a number for each month of the year where the data allow; otherwise one number for the year, or a curve shared by the whole world). Where that translation tested poorly for a country, the answer leads with MODIS's own count instead, and from 2022 on, MODIS's own answer travels with ours whenever the two differ. The full method, how we tested it and its limits are in the web page's "How we know" section and in [../METHOD.md](../METHOD.md). Built at NASA Space Apps 2026 by team Spark Squad from NASA's public FIRMS data.

## Files
`server/server.cjs` (the connector, over stdio) · `server/http_server.cjs` (the same tools over HTTP, for hosting) · `server/protocol.cjs`, `server/fire.cjs`, `server/now.cjs` (shared) · `server/nasa.cjs` and `server/nasa_sources.json` (NASA-direct; talks only to NASA's FIRMS host) · `vendor/` (the engine, the wording code and the data, copied from the web page; `vendor/COPIED.txt` lists each file's hash) · `test/` (`run_tests.cjs`, `run_http_tests.cjs`, `run_nasa_tests.cjs`: run them to see every check; they use NASA's saved files in `test/fixtures_nasa`, no network) · `EXAMPLES.md`.

## License
Apache-2.0, like the rest of the project's code (see `../LICENSE`). Data: NASA FIRMS (public).
