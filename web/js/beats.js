/* beats.js: the rehearsal lines for the story room, one plain data object. Shown only with ?notes=1 (a strip under the stage).
 The order of ideas follows round_SAT/TEACHING_ORDER.md (11:58 AM): each slide
   answers ONE question (its headline), and its first line picks up the bridge the slide before left. Each line is the one on screen,
   after the nine slide reviews (round_SAT/slide_review/APPLIED.md). Numbers on slide 5 are read from the data, so its line has none.
   The talk itself is revised separately; when it lands, change the words below and nothing else. */
window.StoryBeats = {
  source: 'The lines on screen after the slide reviews, Nov 14 afternoon. A title state before slide 1; slides 1-7 numbered; 8 and 9 are the extras.',
  // slide 7's second press (the chat connector). In by default (team lead: "lets make a demo but we may have to cut it for time");
  // set to false to skip that press.
  showConnector: true,
  // slide 1's explainer press (four screens of Fire Detectives, right after the title); false removes the press cleanly
  showExplainer: false,     // off since 1:46 PM ("Yes, take them out"): the four Fire Detectives screens and its detail page leave the click path
  // the flip back to Moe after Vee (off since 1:46 PM; true brings it back, with its hold button)
  showFlipBack: false,
  // slide 2's second press: a quiet strip with each camera's own yearly count (2020 against 2022); false hides it
  showCameraStrip: true,
  // slide 1: Moe and Vee arrive large and centered for a moment, then settle (team lead, 9:01 PM); false turns it off
  showCharacterMoment: true,
  // slide 3's third press: the conversion rule shown in three lines (9:10 PM "show the math"); false shows the earlier sentence
  showMath: true,
  // the order of 9:19 AM (team lead: "move a couple of these scale ones in before the MCP"): slide 5 = the country charts, slide 6 = the
  // connector, slide 7 = "Fire, or something else?" then the final screen. 'v7' = the 9:02 AM order.
  order: 'v8',
  // slide 5's country charts: fewer, bigger ("a little less of the bar graphs"); null = all seven
  countryCharts: ['Brazil', 'India', 'United States', 'Canada'],
  // the calendar screen (slide 6's first press): 'screenshot' = the page's real grid; 'globe' = the globe turning beside the record stacking up (10:56 AM, an experiment)
  // (1:00 PM) 'ridges' = the globe beside the year-by-year ridge landscape (the team lead's pick); 'globe' = the grid stack; 'screenshot' = the page's grid
  calendarLook: 'ridges',
  // click 18 (12:51 PM): 'bands' = the seven fire-power bands with three small number chips; 'bars' = the three-bar ladder
  howGoodLook: 'bands',
  // the final screen's three QR codes (1:49 PM): the web app (the globe page), the connector, the volunteer page
  finalPageQr: true,
  // the "three ways" screen before the final screen (off since 9:19 AM)
  showThreeWays: false,
  // slide 3's math (team lead, 12:39 AM, "we went too deep into the math"): 'short' = the rule is ONE press (clock, twelve numbers, three lines);
  // 'full' brings back the separate "the gap changes with the month" press (the autoplay clips follow 'short')
  mathDepth: 'short',
  // the scale of the long record's pictures (team lead's question, 12:39 AM): 'moe' (default) brings Vee's years
  // down to Moe's scale; 'vee' lifts Moe's years up to Vee's (slide 2's one-scale screen, slide 3's last screen, slide 6's charts, the world
  // chart). Slides 4 and 5 stay on Moe's scale: they are scored against Moe's own counts. Numbers: data/scale_vee.json (tools/build_scale_vee.cjs).
  historyScale: 'vee',     // ruled 8:21 AM: "We should try showing [Vee's] charts", with two tones per bar; 'moe' switches back
  // slide 3: the smarter version that sorts fires by strength (team lead, 10:43 PM), one press between the rule and the one scale; false removes it
  showFirePower: true,
  // slide 4: the left-out-year test walked through in two presses (9:15 PM; trimmed 12:39 AM); false shows the earlier slogan on one press
  showWalkthrough: true,
  // the ending (team lead, 9:38 PM: ending A, "not just Argentina"): 'A' = slide 5 the yardstick then the map, slide 6 not just
  // Argentina then the world on one scale, slide 7 three ways then the final screen. 'old' brings back the earlier slides 5 to 7 whole
  // (the autoplay's clips follow ending A).
  // One press per line of the live script (team lead, 10:37 PM: read live, one person clicks): 30 presses from the title to the final
  // screen, which then stays (Next does nothing there; the extras are on W).
  ending: 'A',
  // ending A, slide 5's first press: 'bars' (the three pairs of bars: "about 3.5 times as high", "within about 10%", "about 3% apart",
  // as the s5_p1 line says them) or 'zoom' (the 0 to 30% ruler with the stitched bar running off it). One press either way.
  yardstickView: 'bars',
  // ending A, slide 7: the "draw an area" prototype card (false: two cards on the same press)
  showDrawCard: false,      // off (redline 8:58 AM: "as long as that's just a prototype on there, we should not have it shown")
  // web addresses on slide 7 and the final screen. EMPTY here on purpose: the public copy must not carry them (the publish scan
  // fails on full addresses and on a surname). On this laptop they are set by local/addresses.js, which the public copy never
  // includes; it is only asked for when the page runs on this computer. Empty, the QR codes and their short labels stand alone.
  pageAddress: null,        // the page
  connectorAddress: null,   // the chat connector
  volunteerAddress: null,   // the volunteer page ("Fire, or something else? Try it"), the final screen's third QR code
  repoUrl: null,            // the code repository (its slot on the final screen shows only when this is set)
  // autoplay (optional; see round_SAT/SUNDAY/narration/AUTOPLAY_HOW_TO.md). The steps and the stretch are in narration/manifest.json.
  // key: the one key that starts it, and only on the title screen (10:37 PM: a stray key mid-talk must not start the voices); starts: which stretches a start may begin, in order of preference
  // ('whole' = title to slide 7's closing screen; 'middle' = slides 3 to 5); beat: seconds of quiet after each clip; voiceAfter: default
  // seconds from a press to its voice (a step's own voiceAfter in the manifest wins; "settled" waits for the slide's motion); readyMax:
  // the longest wait for a slide's motion; captions: 'auto' (only for a step with no clip), 'on' (always), 'off' (never)
  // the whole self-running show (title to the end): OFF today (12:09 PM: the opening and the ending are live); A on the song screen or the first
  // technical screen plays the recorded middle (s2_p1 to s6_p1) and stops on the connector
  wholeShow: false,
  autoplay: { manifest: 'narration/manifest.json', key: 'a', starts: ['middle'], beat: 0.7, voiceAfter: 1.0, readyMax: 8, captions: 'auto' },
  // the opening question, shown as the title state before slide 1 (not counted in the seven)
  opening: { question: 'Is the world burning more than it used to?', bridge: 'To answer, we have to look from space.' },
  scenes: {
    1: { beat: '1', question: "How do we know where it's burning?", bridge: 'To answer, we have to look from space.',
      line: '(title) Is the world burning more than it used to? (press) A satellite camera sees the heat of fire from space. Every dot is a patch of ground about 5 km across where it saw fire that day. Moe is MODIS, NASA\'s older fire camera. (press) Vee is VIIRS, NASA\'s newer fire camera. Same place, same days: the newer camera spots fire about three times as often.',
      handoff: 'Three times the count! So can we still tell if a year is worse than usual?' },
    2: { beat: '2', question: 'Why is that a problem?', bridge: '',
      line: 'Is 2022 worse than usual? Line up Argentina\'s years and 2022 leaps to about double its biggest year: "2022: Argentina\'s worst fire year on record". (press) 2022 is the year the record switches cameras. The jump is mostly sharper eyes. (press) Our fix: for ten years both cameras flew together. So we learned how to translate the newer camera\'s counts into the older one\'s. Now every year sits on one scale.',
      handoff: 'Next question: how do you translate one camera into the other?' },
    3: { beat: '3', question: 'How does the fix work?', bridge: 'How do you translate one camera into the other?',
      line: 'Here\'s how. Look at 2012 to 2021: those ten years have two counts of the same fires. (press) The gap between the two counts changes with the month: in August MODIS counts about 37 for every 100 VIIRS counts, in November about 24. (press) So Argentina gets twelve conversion numbers, one per month: multiply the newer camera\'s count by its month\'s number and you get what the older camera would have counted. (press) Translate every month since 2022, and every year sits on one scale.',
      handoff: 'Nice picture. Is it right?' },
    4: { beat: '4', question: 'How do you know it works?', bridge: 'Nice picture. Is it right?',
      line: 'Leave a year out, translate it, compare. Our translation for October 2017 was about a tenth too low. (press) Left out one year at a time, a typical month lands within about 10% of MODIS alone. (press) MODIS kept flying after 2021, so MODIS alone referees the recent years: for two years we agree almost exactly; since then, ours runs a little low.',
      handoff: 'Does that hold everywhere?' },
    5: { beat: '5', question: 'Where does it work?', bridge: 'Does that hold everywhere?',
      line: 'In most of the countries with a lot of fire, a typical month lands within 25% of MODIS\'s own count (the slide reads the exact count from the data); half are within about 14%. (press) The dark countries are outside this comparison. (press) Every country with a lot of fire now gets twelve conversion numbers, one per month. Now back to Argentina.',
      handoff: 'Now back to Argentina: is it burning more than usual right now?' },
    6: { beat: '6', question: 'Is Argentina burning more than usual?', bridge: 'Our first question, for one place.',
      line: 'About normal for November 1 to 12. The year so far: far quieter than normal, about half the usual. (press) MODIS alone says busier. Two cameras, two answers; the page shows both. (press) Here\'s what you can honestly write.',
      handoff: 'Now it\'s your turn.' },
    7: { beat: '7', question: 'How do I use it?', bridge: 'Now it\'s your turn.',
      line: 'Open the page and pick any country. (press, can be cut) Or ask your own AI: add our connector, then ask about any country. (press) 2022 wasn\'t a record. It wasn\'t close. (press) Is the world burning more than it used to? Check the camera first. Did the world change? Or the camera? Or both?',
      handoff: 'Now you can check. Thank you; stay here for questions.' },
    8: { beat: 'extra 1', question: 'Is every hot spot a fire?', bridge: 'A third thing can fool a fire count: heat that isn\'t fire.',
      line: 'Not every hot spot is a fire. Some places stay hot all year long. (press) VIIRS picks up about nine times as much steady heat as MODIS. Left in, it would make the newer camera read about 7% too busy, so we keep it out.', handoff: 'So how do we keep steady heat out?' },
    9: { beat: 'extra 2', question: 'How do we keep steady heat out?', bridge: 'So how do we keep steady heat out?',
      line: 'Lit up in at least ten months of twelve: a porch light, not a fire. (press) The checks work: for Argentina\'s year, our record comes out about 5% too high with steady heat left in; with either check, under 1%. So the one scale stays clean.', handoff: '(the next press returns to slide 7\'s closing question)' }
  }
};
// This computer only: the slide 7 addresses live in local/addresses.js, outside what the public copy takes (index.html, css, js, data,
// img). It is asked for only when the page runs here (127.0.0.1, localhost or a file), so the public page never requests it.
(function () {
  const h = location.hostname;
  if (location.protocol === 'file:' || h === '127.0.0.1' || h === 'localhost' || /\.localhost$/.test(h)) {
    const sc = document.createElement('script'); sc.src = 'local/addresses.js'; sc.async = false; sc.onerror = () => {}; (document.head || document.documentElement).appendChild(sc);
  }
})();
