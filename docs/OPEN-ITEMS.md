# Open items

Things we deliberately parked or could not verify. Newest first. Tell me which to pick up next.

## The Saga (daily story + illustration)
- **Art style fine-tuning (parked, not important now).** The tested Stable Diffusion checkpoints (`CyberRealisticPony`, `omnigenxl`) render cinematic, photorealistic fantasy even when prompted for anime. Options when you want it: download an anime checkpoint (Animagine XL / an Illustrious-family model), add a character LoRA, or use an IP-Adapter so the hero looks the same every day. The pipeline picks the model through `sdModel` in `data/config.json`, so swapping is a one-line change.
- **Video.** No AnimateDiff extension is installed. Adding it needs an extension install plus a ~1.7 GB motion-module download, so it needs your OK first. Plan: one short clip per hero per day, rendered after the still.
- **Shared GPU (important).** The GPU may be shared with other projects (e.g. a large local LLM). The Saga waits until enough memory is free before loading the storyteller (needs about 18.5 GB free) or Stable Diffusion (about 9 GB), so episodes may be written late at night or whenever other models have unloaded. Options if it waits too often: use a smaller storyteller model, or pin a quiet hour for generation.
- **Story speed.** Nova (`nova-samantha-v1`, 16 GB) takes ~2.5 minutes cold, then seconds if kept warm. It currently unloads right after writing so the GPU is free for images. Fine as a once-a-day background job; a smaller model or `keep_alive` could make it faster.
- **Character consistency.** Same seed and look text helps, but faces still drift between days without a LoRA.
- **Ideas not built:** squad members appearing as allies, special episodes for weekly-boss defeats and level-ups, sharing an episode with the squad, a printable "season" recap.

## Unverified on real hardware
- **Push reminders on your phone.** The encryption matches the official RFC test vector and the scheduler works against a stand-in gateway, but delivery through Google/Apple to your actual phone is untested. Needs an HTTPS link (enable Tailscale Serve), then Hero → Reminder settings → Turn on → *Send a test push*.
- **Service worker / offline mode.** The embedded browser I test in cannot register service workers, so offline mode and the install prompt are untested in a real phone browser.
- **Home-screen install flow** on your phone (Add to Home screen) was not exercised end to end by me.

## Product backlog
- **Household / partner mode** (shared budget and tasks). Demand unconfirmed.
- **Live bank sync.** Deliberately skipped; CSV import covers it without sharing bank logins.
- **Drag-and-drop rescheduling.** Tap-to-move (⏰) is built; drag was skipped as worse on phones.
- **Seasonal game events** (themed monthly content) so the game keeps evolving.
- **Account recovery:** if someone loses their only device and never linked another, their profile can only be recovered from the server file. A "recovery code" screen would fix this.

## Housekeeping
- Tailscale Serve is disabled on your tailnet (admin setting). The plain-IP link works meanwhile.
- The server currently allows 25 profiles (`MAX_PLAYERS`).

## UI refresh ("16-bit Saga"): plan in docs/UI-REFRESH.md
- Done: Phase 0 (groundwork), Phase 1 (theme layer), Phase 2 (colors from tokens everywhere, floating gain numbers, keyboard access).
- Pending: pixel font download (Pixelify Sans, OFL; needs the owner's OK to download, falls back to monospace now), Phase 3 new nav + main menu, Phase 4 forecast card, Phase 5 battle scene for the Saga, Phase 6 polish.
- Saga end-to-end test (story, then picture, in one run) is not yet confirmed: on the dev machine, Ollama and Stable Diffusion failed to allocate memory when Windows ran out of commit headroom (large WSL VM plus a small pagefile).
