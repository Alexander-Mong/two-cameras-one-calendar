# Three example exchanges

 Made by `node test/make_examples.cjs` on Sat Nov 14 2026 16:32:06 GMT-0500 (Eastern Standard Time), from the server talking over stdio (the same messages a chat app sends). In exchange 1, NASA's last-24-hours count comes from NASA's files as saved on Nov 14 at 16:20 UTC and trimmed to a few hundred rows (`test/fixtures_nasa`), so it is smaller than the live count. The text under "What the chat model reads" is the response's text part; the JSON under it is the whole response, structured numbers included.

## 1. Argentina right now (NASA's last 24 hours with the 26-year record's answer)

A person might type: "Is Argentina burning right now?" The chat model then calls:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "fire_now",
    "arguments": {
      "place": "Argentina"
    }
  }
}
```

What the chat model reads:

```text
NASA's 24-hour file shows fire 220 times in the box around Argentina, which takes in nearby areas (VIIRS on NOAA-20), observed between 04:31 UTC Nov 13 and 05:54 UTC Nov 14; 151 of them in the 24 hours before it was fetched. The newest was about 10 hours ago.
On the 26-year record, Argentina's early November is about normal, with almost exactly the usual amount of fire.
The two cameras disagree here: MODIS, NASA's older camera, on its own calls it busier than normal, with about a third more fire than its usual.
Early data: days 1 to 12 from NASA's rapid feed, set against the same days in other years.

Want to know why the two cameras split here?
```

The full response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "NASA's 24-hour file shows fire 220 times in the box around Argentina, which takes in nearby areas (VIIRS on NOAA-20), observed between 04:31 UTC Nov 13 and 05:54 UTC Nov 14; 151 of them in the 24 hours before it was fetched. The newest was about 10 hours ago.\nOn the 26-year record, Argentina's early November is about normal, with almost exactly the usual amount of fire.\nThe two cameras disagree here: MODIS, NASA's older camera, on its own calls it busier than normal, with about a third more fire than its usual.\nEarly data: days 1 to 12 from NASA's rapid feed, set against the same days in other years.\n\nWant to know why the two cameras split here?"
      }
    ],
    "structuredContent": {
      "kind": "fire_now",
      "place": "Argentina",
      "place_file": "Argentina",
      "nasa_last_24h": {
        "seen": {
          "camera": "VIIRS NOAA-20",
          "detections": 220,
          "within_window_before_fetch": 151,
          "newest_utc": "2026-11-14T05:54:00Z"
        },
        "newest_any": {
          "camera": "VIIRS NOAA-20",
          "utc": "2026-11-14T05:54:00Z"
        },
        "cameras": [
          {
            "camera": "VIIRS NOAA-20",
            "detections": 220,
            "within_window_before_fetch": 151,
            "patch_days_5km": 144,
            "per_day": [
              {
                "date": "2026-11-13",
                "detections": 208,
                "patches_5km": 132
              },
              {
                "date": "2026-11-14",
                "detections": 12,
                "patches_5km": 12
              }
            ],
            "newest_utc": "2026-11-14T05:54:00Z",
            "oldest_utc": "2026-11-13T04:31:00Z",
            "day": 139,
            "night": 81,
            "confidence": {
              "nominal": 186,
              "high": 29,
              "low": 5
            },
            "types": null,
            "strongest": [
              {
                "time_utc": "2026-11-13 17:00",
                "latitude": -25.02,
                "longitude": -62.92,
                "camera": "VIIRS NOAA-20",
                "confidence": "high",
                "fire_radiative_power_mw": 154.78,
                "type": null
              },
              {
                "time_utc": "2026-11-13 18:42",
                "latitude": -21.77,
                "longitude": -62.28,
                "camera": "VIIRS NOAA-20",
                "confidence": "nominal",
                "fire_radiative_power_mw": 133.39,
                "type": null
              },
              {
                "time_utc": "2026-11-13 18:40",
                "latitude": -24.07,
                "longitude": -61.19,
                "camera": "VIIRS NOAA-20",
                "confidence": "nominal",
                "fire_radiative_power_mw": 129.44,
                "type": null
              },
              {
                "time_utc": "2026-11-13 17:00",
                "latitude": -25.44,
                "longitude": -59.77,
                "camera": "VIIRS NOAA-20",
                "confidence": "nominal",
                "fire_radiative_power_mw": 75.62,
                "type": null
              },
              {
                "time_utc": "2026-11-13 18:40",
                "latitude": -25.18,
                "longitude": -60.44,
                "camera": "VIIRS NOAA-20",
                "confidence": "nominal",
                "fire_radiative_power_mw": 73.6,
                "type": null
              }
            ]
          },
          {
            "camera": "VIIRS NOAA-21",
            "detections": 220,
            "within_window_before_fetch": 150,
            "patch_days_5km": 180,
            "per_day": [
              {
                "date": "2026-11-13",
                "detections": 200,
                "patches_5km": 161
              },
              {
                "date": "2026-11-14",
                "detections": 20,
                "patches_5km": 19
              }
            ],
            "newest_utc": "2026-11-14T04:57:00Z",
            "oldest_utc": "2026-11-13T05:16:00Z",
            "day": 130,
            "night": 90,
            "confidence": {
              "nominal": 174,
              "high": 9,
              "low": 37
            },
            "types": null,
            "strongest": [
              {
                "time_utc": "2026-11-13 17:43",
                "latitude": -24.1,
                "longitude": -63.94,
                "camera": "VIIRS NOAA-21",
                "confidence": "nominal",
                "fire_radiative_power_mw": 262.67,
                "type": null
              },
              {
                "time_utc": "2026-11-13 17:43",
                "latitude": -26.1,
                "longitude": -60.84,
                "camera": "VIIRS NOAA-21",
                "confidence": "high",
                "fire_radiative_power_mw": 215.91,
                "type": null
              },
              {
                "time_utc": "2026-11-13 17:43",
                "latitude": -21.77,
                "longitude": -62.28,
                "camera": "VIIRS NOAA-21",
                "confidence": "nominal",
                "fire_radiative_power_mw": 126.64,
                "type": null
              },
              {
                "time_utc": "2026-11-13 17:43",
                "latitude": -25.91,
                "longitude": -61.46,
                "camera": "VIIRS NOAA-21",
                "confidence": "nominal",
                "fire_radiative_power_mw": 57.41,
                "type": null
              },
              {
                "time_utc": "2026-11-13 17:43",
                "latitude": -21.91,
                "longitude": -62.18,
                "camera": "VIIRS NOAA-21",
                "confidence": "nominal",
                "fire_radiative_power_mw": 53.57,
                "type": null
              }
            ]
          },
          {
            "camera": "MODIS",
            "detections": 220,
            "within_window_before_fetch": 117,
            "patch_days_5km": 168,
            "per_day": [
              {
                "date": "2026-11-13",
                "detections": 220,
                "patches_5km": 168
              }
            ],
            "newest_utc": "2026-11-13T19:59:00Z",
            "oldest_utc": "2026-11-13T00:17:00Z",
            "day": 168,
            "night": 52,
            "confidence": {
              "nominal": 134,
              "high": 78,
              "low": 8
            },
            "types": null,
            "strongest": [
              {
                "time_utc": "2026-11-13 12:53",
                "latitude": -23.5,
                "longitude": -64.01,
                "camera": "MODIS",
                "confidence": "100",
                "fire_radiative_power_mw": 718.04,
                "type": null
              },
              {
                "time_utc": "2026-11-13 12:53",
                "latitude": -22.21,
                "longitude": -58.84,
                "camera": "MODIS",
                "confidence": "100",
                "fire_radiative_power_mw": 509.24,
                "type": null
              },
              {
                "time_utc": "2026-11-13 12:53",
                "latitude": -22.21,
                "longitude": -58.81,
                "camera": "MODIS",
                "confidence": "100",
                "fire_radiative_power_mw": 468.89,
                "type": null
              },
              {
                "time_utc": "2026-11-13 19:59",
                "latitude": -25.1,
                "longitude": -60.16,
                "camera": "MODIS",
                "confidence": "100",
                "fire_radiative_power_mw": 294.78,
                "type": null
              },
              {
                "time_utc": "2026-11-13 12:53",
                "latitude": -22.19,
                "longitude": -58.84,
                "camera": "MODIS",
                "confidence": "94",
                "fire_radiative_power_mw": 294.59,
                "type": null
              }
            ]
          }
        ],
        "box": {
          "west": -73.7,
          "south": -55.2,
          "east": -53.6,
          "north": -21.7,
          "crosses_180": false
        },
        "window_label": "NASA's 24-hour file",
        "observed_from_utc": "2026-11-13T00:17:00Z",
        "observed_to_utc": "2026-11-14T05:54:00Z",
        "quoted_camera_range": {
          "camera": "VIIRS NOAA-20",
          "from_utc": "2026-11-13T04:31:00Z",
          "to_utc": "2026-11-14T05:54:00Z"
        },
        "trailing_window": {
          "hours": 24,
          "reference_utc": "2026-11-14T16:21:00.000Z",
          "detections_by_camera": {
            "VIIRS NOAA-20": 151,
            "VIIRS NOAA-21": 150,
            "MODIS": 117
          },
          "note": "NASA's 24h file can hold observations older than 24 hours: NASA updates it through the day. These counts keep only the detections observed in the 24 hours up to reference_utc, when the file was fetched."
        },
        "coverage_mode": "rectangles",
        "coverage": {
          "mode": "rectangles",
          "boxes": [
            {
              "west": -73.7,
              "south": -55.2,
              "east": -53.6,
              "north": -21.7
            }
          ],
          "note": "A rectangle drawn around Argentina's outline, widened by 0.1 degree; it takes in nearby areas (edges of neighboring countries and sea). Each detection is counted once, however many boxes or NASA files it shows up in."
        },
        "files": [
          {
            "camera": "VIIRS NOAA-20",
            "nasa_last_updated": "Sat, 14 Nov 2026 15:46:32 GMT",
            "fetched_utc": "2026-11-14T16:21:00.000Z",
            "rows_in_file": 300
          },
          {
            "camera": "VIIRS NOAA-21",
            "nasa_last_updated": "Sat, 14 Nov 2026 15:46:32 GMT",
            "fetched_utc": "2026-11-14T16:21:00.000Z",
            "rows_in_file": 300
          },
          {
            "camera": "VIIRS S-NPP",
            "nasa_last_updated": "Sat, 14 Nov 2026 15:46:32 GMT",
            "fetched_utc": "2026-11-14T16:21:00.000Z",
            "rows_in_file": 0
          },
          {
            "camera": "MODIS",
            "nasa_last_updated": "Sat, 14 Nov 2026 15:46:32 GMT",
            "fetched_utc": "2026-11-14T16:21:00.000Z",
            "rows_in_file": 300
          }
        ]
      },
      "nasa_note": null,
      "record": {
        "place": "Argentina",
        "place_file": "Argentina",
        "period": {
          "asked": "latest",
          "resolved": "latest",
          "kind": "month",
          "label": "November 1–12, 2026",
          "words": "early November",
          "month": "2026-11",
          "year": 2026,
          "season": null,
          "fallback": false,
          "fallback_line": null,
          "requested_unavailable": null,
          "record_ends": "2026-11",
          "from": "2026-11-01",
          "to": "2026-11-12",
          "complete": false
        },
        "season_months": null,
        "verdict": {
          "code": "about usual",
          "words": "About normal",
          "from": "our record"
        },
        "refusal": null,
        "early_data": true,
        "our_record": {
          "label": "our 26-year record: MODIS and VIIRS on one scale",
          "detections": 550,
          "detections_exact": 550.3000327983974,
          "usual": 538,
          "years_compared": 26,
          "verdict_code": "about usual",
          "verdict_words": "About normal",
          "compared_with_usual": "almost exactly the usual",
          "percent_vs_usual": 2,
          "too_little_to_judge": false,
          "verdict_basis": {
            "rule": "rank among the other years for the same dates",
            "rank_fraction": 0.538,
            "other_years": 26,
            "usual_is": "the median of those years"
          },
          "phrase_fits_verdict": true,
          "said_as": "almost exactly the usual",
          "unreliable_here": false
        },
        "modis_alone": {
          "label": "MODIS, NASA's older camera, counted on its own",
          "detections": 757,
          "detections_exact": 757,
          "usual": 556.5,
          "years_compared": 24,
          "verdict_code": "busier",
          "verdict_words": "Busier than normal",
          "compared_with_usual": "about a third more than usual",
          "percent_vs_usual": 36,
          "too_little_to_judge": false,
          "verdict_basis": {
            "rule": "rank among the other years for the same dates",
            "rank_fraction": 0.708,
            "other_years": 24,
            "usual_is": "the median of those years"
          },
          "phrase_fits_verdict": true,
          "said_as": "about a third more than usual"
        },
        "modis_note": null,
        "cameras": "different_direction",
        "cameras_agree": false,
        "both_answers_must_travel_together": true,
        "record_years": 26,
        "record_runs": {
          "from": "2000-11",
          "to": "2026-11"
        },
        "qualifiers": [
          "The two cameras disagree here: MODIS, NASA's older camera, on its own calls it busier than normal, with about a third more fire than its usual.",
          "Early data: days 1 to 12 from NASA's rapid feed, set against the same days in other years."
        ],
        "number_to_remember": {
          "value": 550.3000327983974,
          "said": "about 550",
          "camera": "our record"
        },
        "next_questions": [
          {
            "text": "Want to know why the two cameras split here?",
            "tool": "how_sure",
            "arguments": {
              "place": "Argentina"
            }
          }
        ],
        "unit": "A detection is one 5 km patch of ground where a satellite saw fire on one day, so one big fire counts many times.",
        "acting_now_line": null,
        "source": "NASA FIRMS (MODIS and VIIRS active fire detections)"
      },
      "record_note": null,
      "record_is_current": true,
      "next_questions": [
        {
          "text": "Want to know why the two cameras split here?",
          "tool": "how_sure",
          "arguments": {
            "place": "Argentina"
          }
        }
      ],
      "unit": "A detection is one 5 km patch of ground where a satellite saw fire on one day, so one big fire counts many times.",
      "nasa_unit": "A NASA detection is one satellite pass seeing fire in one spot. NASA's recent counts are not on the 26-year record's scale; \"normal\" comes only from the record."
    },
    "isError": false
  }
}
```

## 2. Australia, December 2019 (a strong result, said as strong)

A person might type: "How bad were the fires in Australia in December 2019?" The chat model then calls:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "fire_answer",
    "arguments": {
      "place": "Australia",
      "period": "December 2019"
    }
  }
}
```

What the chat model reads:

```text
Australia's December 2019 was far busier than normal, with about three times the usual amount of fire.

That's about 13,000 fire detections in December 2019.

Want the rest of 2019 month by month?
```

The full response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Australia's December 2019 was far busier than normal, with about three times the usual amount of fire.\n\nThat's about 13,000 fire detections in December 2019.\n\nWant the rest of 2019 month by month?"
      }
    ],
    "structuredContent": {
      "place": "Australia",
      "place_file": "Australia",
      "period": {
        "asked": "December 2019",
        "resolved": "2019-12",
        "kind": "month",
        "label": "December 2019",
        "words": "December 2019",
        "month": "2019-12",
        "year": 2019,
        "season": null,
        "fallback": false,
        "fallback_line": null,
        "requested_unavailable": null,
        "record_ends": "2025-12",
        "from": "2019-12-01",
        "to": "2019-12-31",
        "complete": true
      },
      "season_months": null,
      "verdict": {
        "code": "much busier",
        "words": "Far busier than normal",
        "from": "our record"
      },
      "refusal": null,
      "early_data": false,
      "our_record": {
        "label": "our 25-year record: MODIS and VIIRS on one scale",
        "detections": 13370,
        "detections_exact": 13370,
        "usual": 4246.3,
        "years_compared": 25,
        "verdict_code": "much busier",
        "verdict_words": "Far busier than normal",
        "compared_with_usual": "about three times the usual",
        "percent_vs_usual": 215,
        "too_little_to_judge": false,
        "verdict_basis": {
          "rule": "rank among the other years for the same dates",
          "rank_fraction": 1,
          "other_years": 25,
          "usual_is": "the median of those years"
        },
        "phrase_fits_verdict": true,
        "said_as": "about three times the usual",
        "unreliable_here": false
      },
      "modis_alone": null,
      "modis_note": "MODIS is counted on its own only from 2022 on.",
      "cameras": null,
      "cameras_agree": null,
      "both_answers_must_travel_together": false,
      "record_years": 25,
      "record_runs": {
        "from": "2000-11",
        "to": "2025-12"
      },
      "qualifiers": [],
      "number_to_remember": {
        "value": 13370,
        "said": "about 13,000",
        "camera": "our record"
      },
      "next_questions": [
        {
          "text": "Want the rest of 2019 month by month?",
          "tool": "place_record",
          "arguments": {
            "place": "Australia",
            "view": "months",
            "year": 2019
          }
        }
      ],
      "unit": "A detection is one 5 km patch of ground where a satellite saw fire on one day, so one big fire counts many times.",
      "acting_now_line": null,
      "source": "NASA FIRMS (MODIS and VIIRS active fire detections)"
    },
    "isError": false
  }
}
```

## 3. Argentina, next season (the future: nothing is certain, here are the patterns to watch)

A person might type: "Will Argentina have a bad fire season next year?" The chat model then calls:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "fire_answer",
    "arguments": {
      "place": "Argentina",
      "period": "next season"
    }
  }
}
```

What the chat model reads:

```text
Nothing about next season is certain, but here are the patterns to watch.
Argentina's fire season usually runs from July to September, and it's usually highest in August.
This year is running far quieter than normal, about half the usual fire so far, and the last season (July to September 2026) was far quieter than normal, about half the usual fire.
The big years, like 2020 and 2003, came in at about double the usual.

Want the latest month's answer for Argentina?
```

The full response:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Nothing about next season is certain, but here are the patterns to watch.\nArgentina's fire season usually runs from July to September, and it's usually highest in August.\nThis year is running far quieter than normal, about half the usual fire so far, and the last season (July to September 2026) was far quieter than normal, about half the usual fire.\nThe big years, like 2020 and 2003, came in at about double the usual.\n\nWant the latest month's answer for Argentina?"
      }
    ],
    "structuredContent": {
      "kind": "patterns_to_watch",
      "place": "Argentina",
      "place_file": "Argentina",
      "asked": "next season",
      "season": {
        "from": "July",
        "to": "September"
      },
      "peak_month": "August",
      "this_year": {
        "period": "2026 so far (January 1 to November 12)",
        "verdict": {
          "code": "much quieter",
          "words": "Far quieter than normal",
          "from": "our record"
        },
        "said": "far quieter than normal, about half the usual fire",
        "early_data": true
      },
      "last_season": {
        "period": "July to September 2026",
        "verdict": {
          "code": "much quieter",
          "words": "Far quieter than normal",
          "from": "our record"
        },
        "said": "far quieter than normal, about half the usual fire"
      },
      "big_years": [
        {
          "year": 2020,
          "detections": 45295,
          "usual": 24451,
          "compared_with_usual": "about double the usual"
        },
        {
          "year": 2003,
          "detections": 45227,
          "usual": 24451,
          "compared_with_usual": "about double the usual"
        }
      ],
      "weak_record": false,
      "next_questions": [
        {
          "text": "Want the latest month's answer for Argentina?",
          "tool": "fire_answer",
          "arguments": {
            "place": "Argentina",
            "period": "latest"
          }
        }
      ],
      "unit": "A detection is one 5 km patch of ground where a satellite saw fire on one day, so one big fire counts many times."
    },
    "isError": false
  }
}
```
