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
- Done: Phase 0 (groundwork), Phase 1 (theme layer), Phase 2 (colors from tokens everywhere, floating gain numbers, keyboard access), Phase 3 (5-slot bar with raised Saga, Menu, Saga tab with chapter strip and chronicle, Config split from Hero, Town reordered), Phase 4 (Fire Emblem-style forecast with live "raise your odds" options, NEW marker on unread episodes), Phase 6 (FF-style level-up window with stat and gear lines, chiptune sound set, perfect-day and boss-hit moments, Status screen with attribute bars and equipment, Sage name plates, Guild party gauges), Phase 5 (turn-based battle scene: encounter, Fight/Skills/Status/Flee, d20 roll landing on the stored result, story pages, victory/training result; calm-mode and keyboard friendly).
- Pending: pixel font download (Pixelify Sans, OFL; needs the owner's OK to download, falls back to monospace now), Phase 6 polish.
- Saga end-to-end run CONFIRMED (2026-10-15): Nova wrote a 160-word episode that used all 4 rituals, the 50-minute focus duel and the real d20 result, and Stable Diffusion painted the portrait, both started on demand and in sequence. The run first waited about 3 minutes for another app's 15 GB model to unload from the GPU (designed behavior), then finished in about a minute and a half. The earlier memory failure was a Windows commit-limit problem that has since cleared (WSL memory dropped).
- Saga quality notes: Nova can slip on small continuity details (said "now a Level 2" before the level-up). Pictures are cinematic semi-anime, not classic anime (the parked art-style item). Long single-paragraph stories are now split into short pages in the battle scene.

## Engagement and hosting
- Done: HTTPS via Tailscale Serve on :443; `publicUrl` config; Nudges (morning story, evening odds, streak-at-risk); tap-to-open routing and app-icon badge; server stores a safe `url` and `badge` per queued push.
- Unverified: real delivery to a phone (needs a device subscribed over the HTTPS link), badge on iOS/Android, tap-through routing on a real device.
- Not built: true home-screen widgets (need a native wrapper, e.g. Capacitor plus an Android/iOS widget), boss and squad event nudges, friend-activity pings (deliberately left out of the gentle default).
- Hosting note: Tailscale Serve allows HTTPS only on ports 443, 8443 and 10000. LifeQuest took 443 (previously proxied to 127.0.0.1:5960); a backup of the old Serve config is in `data/serve-backup-*.json`.
- Battle scene (Phase 5) was tested with the template story only. Still to check with a real AI-written episode: very long paragraphs (the message window scrolls), the generated portrait appearing on the story pages, and real-phone touch and small-screen layout (SE-size).
- Not in the scene yet: a "Gold gained" line (no per-day gold record exists), the sound-effect set beyond blips, a portrait 16-bit filter.
- Phase 6 not yet exercised on real data: Guild party gauges (needs a joined squad), the weekly-boss claim hit with a real claim, and the chiptune sounds on a phone speaker. Not done from the plan: Shop split into Treasury/Merchant, Dojo ring restyle, typewriter on Sage replies, event-log window on Town.

## Anime art style
- Done: Animagine XL 4.0 (Opt) downloaded (6.94 GB, verified byte-for-byte against the source) into the shared checkpoint folder, and the Saga paints through ComfyUI (`imageBackend: comfy`) with a minimal workflow that names only that checkpoint and no LoRAs. First real render: clean cel-shaded anime art of the hero, family-safe. The WebUI backend and `tools/style-test.js` remain as alternatives.
- Still open: character consistency (the face changes daily; a hero LoRA or IP-Adapter would fix it), a second look at prompts for the hero look text, and video (the Wan 2.2 models already in ComfyUI could animate the still; not started).
- Note: ComfyUI also contains unrelated adult-content LoRAs for another project. The Saga workflow never loads them.
- Phase 7 (UX audit fixes): new Town (rituals first, one Saga window, "More today" fold), Daylight replaces Parchment, compact status strip, 44px minimum targets, AA contrast, folds on Money and Hero. See docs/UX-AUDIT.md for before/after numbers. Still not done: first-run copy about the story and reminders, the discoverability prompt for the Saga, Config is still 3.4 screens.
