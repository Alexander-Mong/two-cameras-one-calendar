# Fire, or something else?

**AI use:** this page's code and its build scripts were written with AI coding assistants (Claude, through Claude Code). Its pictures are hand-drawn team art and real satellite pictures; none is AI-generated. Directed and reviewed by the team, Spark Squad. Full statement: [../AI_USE.md](../AI_USE.md).


**A page that asks visitors to judge 50 hot spots: is it a fire, or something else?** Not every hot spot a satellite flags is a fire. Gas flares, factories and volcanoes are hot too, sometimes all year. This page shows a place in pictures and in its heat record from 2020, asks the visitor to pick an answer, and then shows NASA's own label for it.

Live: https://dashboard.alexmong.com/spaceapps/volunteer/

## What is here

| Folder | What it holds |
|---|---|
| `site/` | The page itself: `index.html`, `style.css`, `core.js` (every number and sentence the page shows about a place) and `app.js` (the screens and the live pictures), with `data/places.json` (the 50 places) and `img/` (the hand-drawn characters and the stored Sentinel-2 pictures). Plain HTML, CSS and JavaScript, no build step. |
| `data/` | The working data the tools write: the places, the picture dates and catalog items (`sentinel.json`), and which picture each place opens on. |
| `tools/` | How the places and pictures were made. `build_places.py` picked the places from NASA's 2020 hot spot records; `build_sentinel.py` cut the Sentinel-2 pictures; `check_places.cjs` recomputes every number on the page; `temp_table.cjs` compares the cameras' temperature readings with NASA's label. |
| `picks_server/` | A small service that could save visitors' picks. **Not deployed.** See its [README](picks_server/README.md). |

## Run it

From the top folder of this repository:

```
python -m http.server 8001 --directory volunteer/site
```

Then open http://localhost:8001/. The pictures marked "via GIBS" stream from NASA while you look, so they need an internet connection. Saving picks is off.

## What the tools need

`build_places.py` and `check_places.cjs` read a cut of NASA FIRMS's 2020 hot spot records that is not in this repository (it is large). `build_sentinel.py` reads Sentinel-2 files from the open archive on Amazon Web Services and needs Python with `numpy`, `rasterio` and `Pillow`. The page itself needs none of this: everything it shows is already in `site/`.

## Credits

Live pictures: NASA GIBS. Stored close views and heat pictures: contains modified Copernicus Sentinel data 2020. The answer key is NASA's own label on each detection, which is itself an estimate. Full list: [../DATA_SOURCES.md](../DATA_SOURCES.md).
