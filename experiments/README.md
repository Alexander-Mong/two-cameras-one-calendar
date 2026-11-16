# Six experiments on the method

**AI use:** these experiments were run with AI coding assistants (Claude, through Claude Code), and this summary was drafted with Claude. Directed and reviewed by the team, Spark Squad. Full statement: [../AI_USE.md](../AI_USE.md).


**Short answer:** on the night of November 14, 2026, we ran six experiments to test the method from different sides and to find the limits of what we can claim. Each one's plan was written down before its results were seen.

These are summaries. The full write-ups were working notes that point to files outside this repository, so they are not included. Counts are satellite hot spot detections, not fires and not land burned, and "agrees" means agrees with the older camera (Moe, MODIS), not with the ground.

## E1. Which countries should get twelve monthly numbers?

Some countries have too little fire to learn a number for each month, so they get one number for the whole year. We tested each of the 73 such countries three ways. Twelve numbers did better in 39, made no real difference in 16 and did worse in 17 (one more had too few months to judge). Twelve numbers start paying off once a country's typical fire month has about 10 detections; below about 5 a month they hurt, and the shared world curve is the safer choice. The page has not changed its rule yet: these countries still get one number for the year.

## E2. Is the world burning more than it used to?

We added up the world's record on one scale, from 2003 to 2025, using only countries with a complete record so the set never changes. Detections fell, and the older camera's own count, with no translation, says the same. Most of the drop came before 2012, from South America, Asia and Europe; Africa, which holds more than half of all detections, stayed about flat. The page's own figure, in [../METHOD.md](../METHOD.md), is for a fixed set of 66 countries with complete 2003 to 2025 records: the 2021 to 2025 average is about 14% below 2003 to 2007. That counts detections, not land burned, so it does not say the world is burning less.

## E3. Seven countries, right now

We built this year's months, to November 12, for six more countries on six continents (Canada, Brazil, Australia, Zambia, Indonesia, Spain), plus Argentina. So far this year, three are far quieter than usual (Argentina, Brazil, Zambia), two are busier (Canada, Indonesia) and two are about normal (Australia, Spain). Our record and the older camera alone give the same word for six of the seven. In the first twelve days of November alone, the two cameras differ in five of the seven, so twelve days is an early look, not a verdict. The page itself has this year's months for Argentina only.

## E4. Argentina's biggest misses: what happened those months?

We looked up the ten months where our translation missed most. January 2017 came out 39.5% low: large grassland fires burned in La Pampa, Rio Negro and southern Buenos Aires after a drought, and big fires are the kind the older camera catches well. April 2017 came out 41.5% high: a very wet month with little burning, where a few squares move the percent. Both are likely reasons, not measured ones.

## E5. Did the gap between the cameras drift?

Across the ten shared years, worldwide, the older camera's count per newer-camera count slipped by about 3 to 4% from the first five years to the last five, in 51 of the 71 busy countries. For Argentina as a whole it did not move beyond chance. The drift is real but small, and it explains only part of Argentina's summer misses.

## E6. The fire-power version, deeper

The smarter version sorts the newer camera's hot spots by fire power before converting. It improved by more than one percentage point in 51 of 71 countries (19 changed by a point or less, 1 got worse), and still won in 8 of the 11 busiest countries we checked when every test area near the country being scored was hidden. For Argentina's newest years it did not win, so the plain version stays on. [../METHOD.md](../METHOD.md) explains why.
