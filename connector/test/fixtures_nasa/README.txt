Fixtures for run_nasa_tests.cjs.

Real samples, fetched from NASA FIRMS (host firms.modaps.eosdis.nasa.gov, folder /data/active_fire/) on 2026-11-14 at 16:20:57 UTC
(NASA's files were last updated about 15:40 to 15:46 UTC). Each was trimmed to at most 300 rows: up to 220 inside the box
around Argentina and 80 from elsewhere in the South America file, picked evenly through the file. The header row is NASA's.
  MODIS_C6_1_South_America_24h.csv      (full file: 3,154 rows)
  J1_VIIRS_C2_South_America_24h.csv     (VIIRS on NOAA-20; full file: 10,244 rows)
  J2_VIIRS_C2_South_America_24h.csv     (VIIRS on NOAA-21; full file: 10,661 rows)
  SUOMI_VIIRS_C2_South_America_24h.csv  (VIIRS on S-NPP: NASA's file had the header and no rows; kept as is)

Shaped by hand, NOT recorded from NASA:
  archive_shaped_VIIRS_NOAA20_SP.csv  the NOAA-20 sample above with a "type" column added (0, 1, 2 spread by row number), to
      test how the key path reads NASA's type mark. NASA's archive files carry this column; whether the area API's replies do
      was not checked (NASA's column tables are on another host, outside this lane's allowed host). Not a real API reply.
  not_csv_reply.txt  a one-line text reply standing in for NASA refusing a request. The exact words NASA uses were not seen.
