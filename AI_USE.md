# How AI was used

**Short answer:** AI coding tools wrote the code, the analysis scripts and the scripts that build the data tables, under the team's direction. A second AI model family, from a different company, checked the main numbers and our talk. The idea and every decision were the team's. Some lesson pictures were made with an AI image tool, and each carries a visible mark on the picture. No AI-generated audio or video is part of this project. No outside expert in satellite fire data has reviewed the work.

NASA Space Apps calls these tools "Super Intelligence" (SI) and asks teams to say where and how they were used. This is our full statement.

## Code and analysis

- **Claude models (Anthropic), working through Claude Code**, wrote the code: the harmonization engine, the web app, its story and the seven-slide demo, the connector, the volunteer page, the data scripts that counted NASA's files, the scripts that build the data tables in `web/data/` and `volunteer/data/`, and the scripts that check the numbers. The experiment analyses summarized in `experiments/` were also run by Claude. They worked from the team's written requests, and the team looked at each screen and decided what stayed.
- **A second model family, OpenAI's, working through the Codex command-line tool**, independently recounted the main numbers from our prepared data, without using our engine, and fact-checked the talk. Where it found a fault, we fixed it.
- **Where this is marked (metadata):** the code files say in their header comments that an AI agent made them; the data files carry a `made_with` note that says the same; every HTML page carries a `<meta name="ai-assistance">` tag; [AI_USE.json](AI_USE.json) gives the same facts folder by folder; and each top-level folder's README says it in its first lines. On screen, the web app's pages carry a line saying the code was written with AI coding assistants, and its "How we know" section says it too.

## Pictures

- **Hand-drawn by team members (not AI):** the two satellite characters, Moe and Vee (`web/img/characters/art_*.webp`, and the copies in `volunteer/site/img/`), and the scientist (`web/img/characters/team_human_scientist.png`).
- **Made with an AI image tool (ComfyUI):** the Fire Detectives lesson pictures from the team's earlier kids' explainer. These are `web/img/fire_detectives/` (the young detective, the clouds and the explainer's own satellite characters) and `web/img/explainer/` (pictures of the explainer's pages). Each of these 25 pictures carries a visible mark on the picture itself ("AI-generated art", or "Contains AI-generated art" on the pictures of the explainer's pages), and every screen of the story that shows them also carries a mark.
- **Drawn by code:** charts, maps and the globe, from NASA data.
- **Pictures of our own pages:** `web/img/ending/` and `web/img/slides/` are screen captures of this project's pages, used in the story and the demo.
- **QR codes:** `web/img/qr/`, made with a QR code library.
- **Satellite pictures** on the volunteer page come from NASA and Copernicus, not from AI. See [DATA_SOURCES.md](DATA_SOURCES.md).
- **No NASA logo**, flag or mission identifier appears in any picture.

## Sound and video

**No AI-generated audio or video is part of this project.**

- The talk's technical middle used the team's own recorded voice (not AI-generated, and not in this repository). **Whisper**, a speech-to-text model run on our own computer, found the word times so the recording could be cut into one clip per screen.
- Generated stand-in voices were used only to rehearse the timing. They are not part of the submission.
- **This repository holds no audio.** The story's self-running mode here shows captions only.

## Writing

The project's documents, including this one, and the words on the pages were drafted with Claude and edited by the team.

## What AI did not do

- **The idea and the decisions were the team's:** what to build, what each number means, what the page says and how it says it, and which results to trust.
- **Not AI-made:** the hand-drawn Moe, Vee and scientist; the team's recorded voice; and the song (a folk tune from Newfoundland, Canada, with words by a team member).
- **No outside expert** in satellite fire data has reviewed the method. Agreement with what happened on the ground is untested: our tests compare with NASA's older camera, not with the ground.
