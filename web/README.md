# web: the web app

**AI use:** the code, the data-table build scripts and the number checks in this folder were written with AI coding assistants (Claude, through Claude Code). The pictures in `img/fire_detectives/` and `img/explainer/` were made with an AI image model run in ComfyUI and carry a visible mark; `img/characters/` is hand-drawn by team members. Directed and reviewed by the team, Spark Squad. Full statement: [../AI_USE.md](../AI_USE.md).

This folder is the site as it is served. Open `explore.html` (the globe), `index.html` (the fuller page; `#story/1` is the story), `connector.html` (the connector's page) or `slides.html` (the seven-slide demo).

| Path | What it holds |
|---|---|
| `js/`, `css/` | The pages' code and styles. Plain JavaScript and CSS, no framework, no build step. |
| `parts/engine_and_data/` | The harmonization engine (`engine/hs_engine.js`) and the per-country monthly counts it reads. |
| `data/` | Tables prepared from the same engine (the world table, the fire-power test, the story's end screens). |
| `img/` | Pictures: hand-drawn characters, the AI-made lesson pictures (marked), screen captures of our pages, QR codes. |
| `narration/manifest.json` | The story's captions for its self-running mode. No audio is included. |
| `tools/` | `check_numbers.cjs` recomputes the numbers on the main screens; the `build_*.cjs` scripts rebuild `data/`. Run them from the repository's top folder, for example `node web/tools/check_numbers.cjs`. |

To run it: `python -m http.server 8000 --directory web` from the top folder, then open http://localhost:8000/explore.html.
