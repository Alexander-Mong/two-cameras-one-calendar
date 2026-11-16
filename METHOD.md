# The method, in plain words

**Short answer:** for each country with enough fire, and each month of the year, we learn how many hot spots the older camera counts for every one the newer camera counts, from a ten-year learning window, 2012 to 2021. Thinner records get simpler fallbacks. Then we use those numbers to put the record on one scale. We tested it by hiding one year at a time.

## The two cameras

NASA's fire record comes from two kinds of camera on satellites.

- **Moe = MODIS**, the older camera. The record uses MODIS on NASA's Aqua satellite. Its first twenty months, November 2000 to June 2002, come from MODIS on Terra.
- **Vee = VIIRS**, the newer camera, on the Suomi NPP satellite. Its twin on NOAA-20, adjusted to the same scale, carries the newest days.

Vee sees smaller fires than Moe. So for the same fires, Vee counts far more hot spots. If you just stitch the records together, with Moe up to 2021 and Vee after, the count seems to jump the year the camera changes. The jump is the camera, not the fire.

## What we count

A **hot spot detection** is a square of ground about 5 km across where a camera flagged heat on one day. One big fire makes many detections. So a count is not a count of fires, and not land burned.

All data come from NASA's public fire archive, FIRMS. We counted the detections for each of 235 listed countries and territories, month by month. Records begin in November 2000 where available and run as far as December 2025; 55 end earlier, and five have no usable month. Argentina also has early data through November 12, 2026.

## Step 1: learn the conversion number

Both cameras have flown since 2012, and both still fly. We learn from a ten-year window, 2012 to 2021, in which we have two counts of the same fires.

For each country and each month of the year, we add up everything Moe counted in that month across those years, and divide by everything Vee counted in the same months.

> **Worked example: Argentina, August.** 62,467 ÷ 169,528 = 0.37.

So a country with enough fire gets twelve numbers, one per month of the year. Argentina's run from about 0.24 to 0.37.

**Why twelve, not one?** The gap between the cameras changes with the seasons. In Argentina, Moe counts about 37 for every 100 of Vee's in August, and about 24 in November. One number for the whole year would be wrong in most months.

**Not every place has enough fire for twelve.** Of the 235 places listed, 90 get a number for each month, 73 get one number for the whole year, 15 borrow a curve shared by the whole world, and 57 have too little fire to convert. Where a record is thin, the page says so in plain words instead of showing a number it cannot stand behind. Months with no data stay missing; nothing is filled in.

## Step 2: use the number

- **Vee to Moe:** multiply Vee's count by the month's number. That estimates what Moe would have counted.
- **Moe to Vee:** divide Moe's count by the month's number. That estimates what Vee would have counted.

In the charts of our talk we lift Moe's older years up to Vee's scale, because Vee is the camera going forward. Either way, a change in camera no longer looks like a change in fire.

## Step 3: test it by hiding a year

We hold one year out. We learn the numbers from the other nine years of the learning window. We translate the held-out year and compare it with what Moe really counted. Then we do that for every year.

> **Worked example: October 2017 in Argentina.** We hid 2017 and learned October's number from the other nine years: 0.2873. Vee counted 6,035 hot spots. 6,035 × 0.2873 gives 1,734. Moe counted 1,921. Our estimate is 9.7% low.

**Argentina, every month.** Across all 119 tested months, a typical month lands within 9.5% of Moe's own count, and nine months in ten within about 30%. "A typical month" means the middle month: half the tested months landed closer than that, half further. It is the median, not the average.

**Beyond Argentina.** In all 71 countries with a lot of fire, a typical month lands within 25%. The middle country is at about 12%.

**A month that missed.** January 2017 in Argentina came out about 40% low. That summer, after a drought, large wildfires swept the Pampas; NASA's Earth Observatory wrote about them on January 5, 2017. Big fires are the kind Moe catches well, so the usual gap did not apply. That is a likely reason; we did not measure it.

## What changes when the cameras share one scale

**Argentina.** Just stitched together, Vee reads about 3.5 times what Moe counts in a typical Argentine month. That is why 2022 looks like a record: stitched, it shows 89,310 against an earlier biggest year of 45,295, about double. On one scale, 2022 is 89,043 against a typical year of 77,217: about 15% above normal, and far below 2020's 144,130.

**The world.** Among the years we could compare, 63 of 65 countries with a lot of fire have their biggest year after 2021 when the records are stitched together. On VIIRS's scale, 9 do. Canada's 2023 stays its biggest year either way.

**Is the world burning more?** Across a fixed set of 66 countries with complete records from 2003 to 2025, on one scale, the 2021 to 2025 average is about 14% below 2003 to 2007. That counts detections, not land burned, so it does not settle the question.

## The smarter version: built and tested, not switched on

Moe is more likely to catch strong fires than faint ones: about 4 in 100 of the faintest, about 57 in 100 of the strongest. So we built a second version that first sorts Vee's hot spots into seven bands by **fire power** (how much heat a fire gives off), then applies the twelve month numbers.

In the same hide-a-year test, with each test year left out of the country's monthly numbers, it does better:

- Argentina goes from 9.5% to 7.0%.
- 51 of the 71 countries improve by more than one percentage point, 19 change by a point or less, and 1 gets worse.

One limit of that test: the fire-power curve shared by all countries was learned once and was not re-learned without each test year.

**Why it is not switched on.** Month by month it is better. But for Argentina's yearly totals after 2021 it came out further from Moe than the plain version did. For example, in 2022 the plain version was within half a percent of Moe; the smarter one was about 9% over. We want to understand that before we switch it on. That is our next step.

## What this does and does not show

- **Agreement is with Moe, not with the ground.** The test shows how well we match the older camera, the only one with real counts in both eras. It does not say which camera is closer to what happened on the ground.
- **Counts are detections**, not fires and not land burned.
- **Nothing here is a forecast.**
- **The record** runs through December 2025, with early data for Argentina this month. The newest days can still change.
- **No outside expert** in satellite fire data has reviewed this work.

## Where the code is

- The engine: `web/parts/engine_and_data/engine/hs_engine.js`. The same file runs in the web page and in the connector (`connector/vendor/`).
- The checks that recompute the numbers on the main screens from the data: `node web/tools/check_numbers.cjs`.
- The smarter version's test table: `node web/tools/build_fire_power.cjs` rebuilds `web/data/fire_power.json`.
