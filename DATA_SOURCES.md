# Data sources, tools and fonts

**Short answer:** every fire number comes from NASA FIRMS. The volunteer page also shows pictures from NASA GIBS and from Copernicus Sentinel-2. Country outlines come from Natural Earth. Below, each source's terms are given as far as we could confirm them; where we could not, this list says so instead of guessing.

## NASA data

### NASA FIRMS (Fire Information for Resource Management System)

NASA's public fire archive: https://firms.modaps.eosdis.nasa.gov

What we used:

- **Yearly country files, 2000 to 2025.** MODIS on the Terra and Aqua satellites (the first rows are November 2000), VIIRS on Suomi NPP (from January 20, 2012) and VIIRS on NOAA-20 (from 2018). The page describes them as MODIS Collection 6.1 and VIIRS 375 m.
- **Area files for 2026** (Argentina's newest months): the standard processing sets `MODIS_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA20_SP` and, for the newest days, the near-real-time sets `MODIS_NRT`, `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`.
- **Recent-detection files** (the last 24 hours, 48 hours or 7 days), fetched by the connector only when someone asks. They need no key. Older dates through the connector need the asker's own free NASA map key.

Terms: NASA promotes the full and open sharing of its data, and asks that users credit NASA FIRMS and name the product and collection, as we do here. We could not confirm the exact current wording on NASA's FIRMS and Earthdata pages.

How we used it: we counted detections into squares of about 5 km per day, for each country and month, and built every number from those counts. The page also quotes NASA's own caution about these data, word for word.

### NASA GIBS (Global Imagery Browse Services)

Pictures that stream live into the volunteer page, from https://gibs.earthdata.nasa.gov:

- HLS (Harmonized Landsat Sentinel-2), 30 m, both the Sentinel-2 and the Landsat layers ("Landsat courtesy NASA/USGS" on the Landsat ones)
- MODIS Terra and Aqua true color, 250 m, and MODIS bands 7-2-1 false color
- VIIRS Suomi NPP false color (bands M11, I2, I1) with the VIIRS 375 m thermal anomalies (FIRMS fire dots), by day and by night
- NASA Black Marble night lights (VIIRS, 2016)

Credit line, shown on the page: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)." Each picture also carries its own short credit in its corner.

### NASA Earth Observatory

The story cites NASA Earth Observatory's report of January 5, 2017 on the large wildfires in Argentina's Pampas, to explain one month our method missed. Only the fact is cited; no text or picture is copied.

## Other data

### Copernicus Sentinel-2 (European Union)

The volunteer page's stored 10 m close views and 3 km heat pictures were cut from Sentinel-2 Level-2A files in the open archive on Amazon Web Services, found through the Earth Search catalog. Each picture is 300 pixels, saved with the page in `volunteer/site/img/places/`.

Credit, on every such picture and on the page: **"Contains modified Copernicus Sentinel data 2020"**.

### Natural Earth

Country outlines (1:10m admin-0 countries), used to cut 2026 rows to a country's border and, simplified, to draw the world map and the globe.

Terms: "Natural Earth is a public domain map dataset."

## Related work named on the page

The page's "How we know" section names other public fire tools and research as plain facts: Brazil's INPE, GWIS, EFFIS, Global Nature Watch, Argentina's CONAE, FireCalendar, a fire-power record by Zheng and others (2026), and GFED5. None of them is connected to this project, and none of their data is used.

## Tools

| Tool | What it did |
|---|---|
| Python 3.12, with DuckDB, PyArrow and NumPy | Counted NASA's raw files into the small monthly tables |
| Python with rasterio and Pillow | Cut the Sentinel-2 pictures for the volunteer page |
| Node.js | Runs the number checks, the table builders and the connector |
| Microsoft Edge, headless | Took pictures of each screen and checked that the pages load |
| ffmpeg, and Whisper speech-to-text run on our own computer | Cut the recorded voice for the talk (no audio is in this repository) |
| Python `qrcode` package, and OpenCV | Made the QR codes and read them back to check them |

The web app and the connector use no outside library: plain HTML, CSS and JavaScript in the browser, and Node.js's own modules in the connector. Each tool is used under its own license; we do not list those licenses here.

## Fonts

Fredoka, Lexend and JetBrains Mono, loaded from Google Fonts when the page opens. The pages fall back to fonts already on the visitor's computer if Google Fonts cannot be reached. Their licenses are on each font's Google Fonts page; we do not restate them here.

## Art and music

- **The two satellite characters (Moe and Vee) and the scientist** were drawn by hand by team members for this project.
- **The Fire Detectives lesson pictures** (the young detective, the clouds, and the lesson pages shown at the start of the story) were made with an AI image model, FLUX.2 klein 4B by Black Forest Labs (Apache 2.0, https://huggingface.co/black-forest-labs/FLUX.2-klein-4B), run in ComfyUI (https://github.com/comfyanonymous/ComfyUI). See [AI_USE.md](AI_USE.md).
- **Charts, maps and the globe** are drawn by the page's own code from NASA data. There is no NASA logo anywhere.
- **The song** on the story's first slide uses a folk tune from Newfoundland, Canada, with words by a team member, credited on that screen. Nothing plays; the team sang it live.

The Apache License 2.0 covers the code only. It does not cover the art, the song's words or the data; no license is granted for them in this repository.
