# LifeQuest UI Refresh: "16-bit Saga"

A design proposal for moving LifeQuest toward an old-school turn-based JRPG feel (SNES/PS1: Final Fantasy, Dragon Quest, Chrono Trigger, Fire Emblem menus) without losing what already works: phone-first, readable, fast, accessible. Nothing here requires a build step, a framework, or image assets beyond one font file.

Status: proposal only. No app files have been changed.

---

## 1. Overview: where the UI is today

### What exists

| Area | Where | What it looks like now |
|---|---|---|
| Theme | `public/style.css` (137 lines), `:root` tokens `--bg #0f0b1e`, `--card #1f1942`, `--acc #8b5cf6`, `--gold`, `--good`, `--bad`, six stat colors | A modern "purple glassmorphism" SaaS look: 14 to 24px rounded corners (`.card` 18px, `.task` 16px, `.btn` 14px, `#modal .sheet` 24px), soft gradients, `system-ui` font, a fixed radial gradient on `body`, `backdrop-filter: blur(14px)` on `nav` |
| Header | `hud()` in `app.js` | Round avatar emoji, name, `Lv · title · cur/need XP`, smooth gradient `.bar`, coin and chest `.chip` pills |
| Tabs | `NAV` array (`app.js` ~line 1058), rendered at the end of `render()` | 7 equal buttons: Today, Plan, Money, Focus, Squad, Coach, Hero. The override at the end of `style.css` shrinks labels to `.62rem` (about 10px) and icons to 20px to fit 7 across |
| Today | `viewToday()` | A long vertical stack: coach tip card, then `hooks('today-top')` (Saga card + "Tonight" odds card), `restBanner`, `slipCard`, `autoCard`, `stakeCard`, `weeklyTeaser`, `nextBlockStrip`, `nextUpCard`, `moneyTeaser`, `hooks('today')`, check-in, habits |
| Saga | `public/ext-saga.js` | `sagaCard()` (episode thumbnail 190px, title, one-line `diceLine()`), `sagaTonight()` (boss, odds %, bar, rules text), `sagaRead()` (bottom-sheet modal: image 420px, a static "🎲 14" in 3rem text, outcome label, story paragraphs), `sagaSettings()` inside the Hero tab |
| Bosses | Three separate systems | Focus boss (`BOSSES`, `newBoss()`, `viewFocus()`), weekly boss (`WBOSSES`, `weeklyCard()` on Plan, also the Saga villain via `sagaCheck()`), squad raid boss (`raidBoss()`, `viewBoard()`) |
| Feedback | `sfx` (Web Audio `tone()`), `buzz()`, `confetti()` on `#fx` canvas, `toast()`, `levelUp()` modal | Good bones. Sound defaults to ON (`defaults().settings.sound: true`). "Calm mode" only disables confetti |
| Modals | `openModal()` / `#modal .sheet` | iOS-style bottom sheet with slide-up animation |

### Where it falls short of the RPG goal

1. **It reads as a productivity app wearing RPG words.** Language says "boss", "quest", "XP", but the visual grammar (pill buttons, rounded glass cards, gradient bars, `system-ui`) is the 2020s fintech/wellness look. Nothing evokes a window frame, a cursor, a command menu, or a pixel grid. Screenshot `docs/screenshots/2-saga-begins-odds-25.jpg` could be any habit app.
2. **The Saga, the central feature, is a card among ten.** On Today it is the second card, under the coach tip, and competes with eight other `hooks`/teasers. Its settings live at the bottom of Hero. Reading an episode is a generic bottom sheet. The d20, the most dramatic moment in the whole app, is a static number (`sagaRead()`: `font-size:3rem` "🎲 ${c.d20}"). There is no reveal, no turn, no battle.
3. **The odds preview is a paragraph.** `sagaTonight()` explains the modifier rules in 40 words of `.sm.dim` text. Fire Emblem solved this exact problem with the combat forecast window (HIT / DMG / CRIT). We have all the numbers already (`sagaOdds`, `c.mod`, `c.bonus`, `c.dc`).
4. **Three unrelated bosses** (focus, weekly, raid) dilute the "one villain this week" story the Saga is building. The weekly boss on Plan and the Saga villain are the *same entity* (`WBOSSES`) but presented in two different ways.
5. **Navigation is cramped.** Seven tabs at ~10px labels fail legibility on a 375px phone and offer no hierarchy: Coach (rarely used) has the same weight as Today.
6. **Hero is a dashboard, not a status screen.** The game data for a proper JRPG status screen already exists in `ext-saga.js` (`SAGA_ABILITY` STR/INT/WIS/DEX/CHA/LCK, `SAGA_CLASS`, `sagaGear(lv)`, `abilityMod()`), yet `viewHero()` shows a radar chart of emoji and then settings.
7. **Theming is leaky.** There are ~190 inline `style="..."` attributes across `public/*.js`, several with hard-coded hex: `sagaImgTag()` (`#2a2257,#1f1942` gradient), `radar()` (`#3a3170`, `#8b5cf655`, `#c4b5fd`, `#f1eeff`), `viewFocus()` ring (`#2a2257`, gradient `#8b5cf6 → #fbbf24`), `confetti()` colors. A token swap alone will not fully reskin these.
8. **Accessibility gaps that a menu-driven UI would expose:** clickable rows are `div.task[data-act]` with no `role`, `tabindex` or key handler; `.del` icon buttons are about 36px; `.sm` is `.82rem` (~13px), `.tag` is `.68rem` (~11px); there is no `prefers-reduced-motion` handling anywhere; no light theme.
9. **Every `render()` replaces `#app.innerHTML`.** Any CSS entrance animation on elements inside `#app` replays on every tap (toggling a habit re-renders everything). This shapes how motion must be done (section 5).

---

## 2. Design direction

**One-line brief:** *A SNES menu you can read on a bus.* Pixel-flavored chrome (frames, cursor, bars, numbers, headings), clean system text for anything longer than a sentence.

### 2.1 Principles

1. **Chrome is retro, content is modern.** Window frames, cursor, bars, numbers, headings and command labels use the pixel font and hard edges. Paragraphs (story text, coach chat, journal, inputs) stay in a legible sans. This is how good modern retro games (Octopath, Sea of Stars UI) stay readable.
2. **Hard edges, no blur.** Radius 0 to 4px, no `backdrop-filter`, no soft drop shadows. Depth comes from stacked 2px borders.
3. **Motion in steps.** Retro motion is quantized: `steps()` timing, 2-frame bobs, instant cuts. Cheaper to render and more on-brand.
4. **The Saga is the heart.** It gets the center nav slot, the top of Town, and the only full-screen scene in the app.
5. **Honest game.** The d20 is fixed at dawn from a seed (`sagaD20`). Animations dramatize a result; they never imply the player can influence it after the fact. Label it: "The die was cast at dawn."

### 2.2 Palette tokens

Keep the *existing token names* so every current rule picks up the new skin for free, and add a few RPG-specific ones. Default dark skin is "Night Window" (FF-blue windows on near-black). Light skin is "Parchment" (Dragon Quest / Fire Emblem map-screen beige).

```css
/* public/theme-rpg.css: loaded after style.css; active when <html data-skin="rpg"> */
:root[data-skin="rpg"]{
  /* surfaces */
  --bg:#08091a;        --bg2:#10133a;
  --card:#1b2a8f;      --card2:#2639b8;      /* the classic window blue */
  --win-top:#2f45c9;   --win-bot:#101a66;    /* window gradient */
  --line:#e8ecff;      --line-dark:#04051a;  /* white frame + black outer edge */
  /* text */
  --txt:#ffffff;       --dim:#b9c3ff;        /* 7.9:1 on --card */
  /* accents */
  --acc:#ffd23f;       --acc2:#ffe98a;       /* cursor / selection = gold */
  --gold:#ffd23f; --good:#5cf28a; --bad:#ff5d73; --blue:#7fd4ff;
  --hp:#5cf28a; --hp-low:#ffd23f; --hp-crit:#ff5d73; --mp:#7fd4ff; --xp:#ffd23f;
  /* stats keep their hue, brightened for blue windows */
  --mind:#7fd4ff; --body:#ff8a8a; --spirit:#d6a8ff; --craft:#ffd23f; --social:#6ff0a8; --wealth:#ffb547;
  /* type */
  --font-ui:"Pixelify Sans", ui-monospace, "Cascadia Mono", "Courier New", monospace;
  --font-text:system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --px:2px;            /* one "pixel" of chrome */
}

/* Parchment: follows the OS unless the user picked a theme explicitly */
@media (prefers-color-scheme: light){
  :root[data-skin="rpg"]:not([data-theme="dark"]){
    --bg:#e9dcb8; --bg2:#f3e9cc; --card:#fbf3dc; --card2:#f1e2b6;
    --win-top:#fff8e4; --win-bot:#efdfb3;
    --line:#3b2a14; --line-dark:#3b2a14;
    --txt:#2a1d0c; --dim:#6b5434;          /* 7.4:1 on --card */
    --acc:#b5261e; --acc2:#8c1c16;         /* red cursor, like DQ */
    --gold:#8a5a00; --good:#1f7a3a; --bad:#b5261e; --blue:#1d5aa6;
    --hp:#1f7a3a; --hp-low:#8a5a00; --hp-crit:#b5261e; --mp:#1d5aa6; --xp:#8a5a00;
  }
}
:root[data-skin="rpg"][data-theme="light"]{ /* same block as above, for a manual override */ }
```

Notes:
- Gold `#ffd23f` on window blue `#1b2a8f` is about 8:1; white on it is about 11:1. Keep `--dim` no darker than shown.
- Update `<meta name="theme-color">` from JS when the skin changes (`#08091a` dark, `#e9dcb8` light) so the phone status bar matches.
- Replace the fixed `body` radial gradient with a flat color plus a cheap optional pattern (below). `background-attachment: fixed` causes scroll repaints on mobile.

```css
:root[data-skin="rpg"] body{
  background:var(--bg);
  /* faint 4px dither, costs nothing, reads as "screen" */
  background-image:radial-gradient(color-mix(in srgb,var(--line) 6%,transparent) 1px,transparent 1px);
  background-size:4px 4px;
}
```

### 2.3 Typography

**Pick: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans)** (SIL Open Font License, variable weight 400 to 700). It is a pixel-grid design with real lowercase, normal letter widths, and good x-height, so it stays readable at 16px on phones, unlike Press Start 2P (too wide; needs 8px multiples; illegible as body text) or VT323 (thin, low contrast at small sizes).

Self-host it, no Google CDN call (the app is self-hosted and should work offline):

```
public/fonts/PixelifySans-Latin.woff2   (~30 to 45 KB, Latin subset)
```

```css
@font-face{
  font-family:"Pixelify Sans";
  src:url("/fonts/PixelifySans-Latin.woff2") format("woff2");
  font-weight:400 700; font-display:swap;
  unicode-range:U+0000-00FF,U+2013-2014,U+2018-201D,U+2026,U+2190-2193,U+25B2-25BC;
}
:root[data-skin="rpg"] body{font:16px/1.5 var(--font-text);-webkit-font-smoothing:antialiased}
:root[data-skin="rpg"] :is(h2,.btn,.chip,.nm,.hud .ttl,nav button,.seg button,.pills button,
  .stat b,.price,.tag,.cmd,.win-title,.num){font-family:var(--font-ui);letter-spacing:.02em}
```

Rules:
- Pixel font for: headings, button/command labels, names, numbers (HP, XP, gold, odds, d20), tab labels, window titles.
- System font for: story paragraphs, coach chat, journal, form inputs, any help text over ~12 words.
- Sizes: 16px minimum for anything in the pixel font, 14px minimum for system secondary text. Retire `.68rem` tags and the `.62rem` nav labels.
- Numbers: `font-variant-numeric: tabular-nums` is not supported by most pixel fonts; set fixed `min-width` in `ch` on counters that tick.
- Add `/fonts/...woff2` to `SHELL` in `public/sw.js` and bump `CACHE` to `lifequest-v4`, otherwise the offline shell renders the fallback.
- Fallback (`ui-monospace`, Courier) is deliberately monospace: if the font fails, the UI still reads "terminal/retro" instead of "broken".

### 2.4 Window frames (pure CSS)

The signature JRPG element. Two variants: **FF window** (blue gradient, white rounded frame) for the dark skin, **DQ window** (solid fill, thick frame) for parchment. Both are the same CSS driven by tokens.

```css
/* box-shadow stack: black outer edge, white frame, black inner edge. No images. */
:root[data-skin="rpg"] :is(.card,.task,.stat,.badge,.hud,#modal .sheet,.win){
  background:linear-gradient(180deg,var(--win-top),var(--win-bot));
  border:0; border-radius:4px;
  box-shadow:
    0 0 0 var(--px) var(--line-dark),                       /* outer black hairline   */
    inset 0 0 0 var(--px) var(--line),                      /* white frame            */
    inset 0 0 0 calc(var(--px)*2) var(--line-dark),         /* inner black hairline   */
    inset 0 calc(var(--px)*3) 0 0 rgb(255 255 255 / .08);   /* top bevel highlight     */
  padding:14px 14px 12px;
}
/* window title plate, like "STATUS" or "ITEM" tabs on PS1 menus */
.win-title{display:inline-block;margin:-2px 0 8px;padding:2px 10px;font-size:16px;
  background:var(--line-dark);color:var(--acc);border-radius:2px}
```

For a true pixel-corner frame (notched corners instead of rounded), use a 9-slice `border-image` from an inline SVG, which stays crisp at any DPR:

```css
.win.px{
  border:6px solid transparent; border-radius:0; box-shadow:none;
  border-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' d='M4 0h10v2H4zM4 16h10v2H4zM0 4h2v10H0zM16 4h2v10h-2zM2 2h2v2H2zM14 2h2v2h-2zM2 14h2v2H2zM14 14h2v2h-2z'/%3E%3C/svg%3E") 6 / 6px stretch;
  background-clip:padding-box;
}
```

Use `.win.px` for the battle scene and the main menu (big hero moments), the box-shadow version everywhere else (cheaper, theme-aware since `--line` changes in parchment).

### 2.5 Buttons as commands, and the cursor

Buttons become command labels in a window, not pills. The selected/hovered/focused item gets the bobbing hand/triangle cursor.

```css
:root[data-skin="rpg"] .btn{
  font-family:var(--font-ui);font-size:18px;min-height:44px;padding:10px 16px 10px 30px;
  background:var(--line-dark);color:var(--txt);border-radius:2px;position:relative;text-align:left;
  box-shadow:inset 0 0 0 var(--px) var(--line);
}
:root[data-skin="rpg"] .btn.gold{background:var(--acc);color:var(--line-dark)}
:root[data-skin="rpg"] .btn.ghost{background:transparent;color:var(--acc2)}
:root[data-skin="rpg"] .btn.red{background:#5a0d18;color:#ffd0d6}

/* the cursor: a pixel triangle, 2-frame bob */
.cmd::before,:root[data-skin="rpg"] .btn::before{
  content:"";position:absolute;left:10px;top:50%;width:10px;height:12px;margin-top:-6px;
  background:var(--acc);clip-path:polygon(0 0,100% 50%,0 100%);opacity:0;
}
:root[data-skin="rpg"] :is(.btn,.cmd):is(:hover,:focus-visible,.on,[aria-current="true"])::before{
  opacity:1;animation:cursor-bob .5s steps(2) infinite;
}
@keyframes cursor-bob{50%{transform:translateX(3px)}}
:root[data-skin="rpg"] :focus-visible{outline:var(--px) dashed var(--acc);outline-offset:3px}
```

On touch devices `:hover` sticks after a tap, which is fine here: the last tapped command keeps the cursor, which is exactly how a JRPG menu behaves.

Command list markup (used in the battle panel, main menu, habit row menus):

```html
<div class="win cmds" role="menu" aria-label="Command">
  <button class="cmd" role="menuitem" data-act="bt-fight">Fight</button>
  <button class="cmd" role="menuitem" data-act="bt-skills">Skills</button>
  <button class="cmd" role="menuitem" data-act="bt-status">Status</button>
  <button class="cmd" role="menuitem" data-act="close">Flee</button>
</div>
```
```css
.cmds{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.cmd{position:relative;min-height:48px;padding:0 12px 0 28px;text-align:left;background:none;
  font:20px var(--font-ui);color:var(--txt)}
.cmd[aria-disabled="true"]{color:color-mix(in srgb,var(--txt) 40%,transparent)}
```

### 2.6 HP / XP / MP bars

Segmented, hard-edged, with a label in the pixel font. Reuse the existing `.bar > i` markup so `hud()`, `weeklyTeaser()`, envelopes and boss HP all upgrade at once.

```css
:root[data-skin="rpg"] .bar{
  height:12px;border-radius:0;background:var(--line-dark);
  box-shadow:0 0 0 var(--px) var(--line);margin-top:8px;overflow:hidden;
}
:root[data-skin="rpg"] .bar>i{
  border-radius:0;background:var(--xp);
  /* 1px dark notch every 6px = segmented gauge */
  -webkit-mask:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 6px);
          mask:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 6px);
  transition:width .6s steps(12);
}
:root[data-skin="rpg"] .bar.red>i{background:var(--hp)}          /* boss HP reads as HP */
:root[data-skin="rpg"] .bar.gold>i{background:var(--gold)}
.bar.hp-low>i{background:var(--hp-low)} .bar.hp-crit>i{background:var(--hp-crit);animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:.55}}
```

Stat line pattern (status screens, party rows):

```html
<div class="gauge"><span class="lbl">HP</span><span class="num">312/450</span><div class="bar red"><i style="width:69%"></i></div></div>
```
```css
.gauge{display:grid;grid-template-columns:2.5ch 1fr;align-items:end;column-gap:8px;font-family:var(--font-ui)}
.gauge .lbl{color:var(--acc)} .gauge .num{text-align:right} .gauge .bar{grid-column:1/-1;margin-top:2px}
```

### 2.7 Typewriter text

Used in the Saga reader, battle messages, level-up window and new coach replies only (never on every render).

```js
// ext-rpg.js
function typeInto(el, text, cps = 45) {
  return new Promise(done => {
    if (rpgCalm()) { el.textContent = text; return done(); }
    el.setAttribute('aria-label', text);              // screen readers get the whole line at once
    const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true'); el.replaceChildren(vis);
    let i = 0, t0 = performance.now(), skip = () => { i = text.length; };
    el.closest('.win')?.addEventListener('click', skip, { once: true });
    (function step(now) {
      i = Math.max(i, Math.floor((now - t0) / 1000 * cps));
      vis.textContent = text.slice(0, i);
      if (i % 3 === 0 && i < text.length) blip();     // optional chiptune tick, only when sound is on
      if (i < text.length) requestAnimationFrame(step); else { el.insertAdjacentHTML('beforeend', '<i class="more" aria-hidden="true">▼</i>'); done(); }
    })(t0);
  });
}
```
```css
.more{display:inline-block;margin-left:6px;color:var(--acc);animation:cursor-bob .6s steps(2) infinite}
```

Tap once to finish the line, tap again to advance: the classic two-tap rhythm.

### 2.8 Sound: optional, off by default

- Change `defaults().settings.sound` to `false` so *new* profiles start muted. Do not flip existing saves (`migrate()` keeps their choice).
- Add a chiptune voice using the existing `tone()` with `type: 'square'`, low volume (.04):
  - `blip` cursor move: `tone(1320,.03,0,'square',.03)`
  - `confirm`: `tone(880,.05,0,'square'); tone(1320,.08,.05,'square')`
  - `fanfare` (level up): the existing `sfx.level` arpeggio in square wave plus a held top note.
  - `dice`: 8 quick random ticks between 600 and 1400 Hz, then a low thud.
- No audio files. Everything is synthesized, so zero bytes on the wire.

### 2.9 Sprites and emoji

Emoji are user content (habit icons, avatars) and will stay. They clash a little with pixel chrome, but the window frames absorb most of it. Two cheap moves:
- Put every emoji "sprite" (avatar, boss, habit icon) inside a framed square `.sprite` (1:1 window, flat `--line-dark` background) so it reads as a portrait slot.
- For chrome icons (nav, menu), use Unicode glyphs in the pixel font or 16x16 inline SVGs with `shape-rendering="crispEdges"`, not emoji. A 7-icon SVG sprite is under 2 KB.

### 2.10 The Saga portrait: a "16-bit filter"

The generated Stable Diffusion image is the biggest visual asset. Offer a toggle (default on in the RPG skin) that downsamples it on a canvas and scales it back with `image-rendering: pixelated`. Zero server change, ~20 lines:

```js
function pixelate(img, w = 128) {
  const h = Math.round(w * img.naturalHeight / img.naturalWidth), c = document.createElement('canvas');
  c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, w, h);
  c.className = 'portrait-px'; return c;
}
```
```css
.portrait-px{width:100%;height:auto;image-rendering:pixelated;display:block}
```

Cache the canvas `toDataURL()` in `sagaRT.imgs` alongside the blob URL so it is not recomputed per render.

---

## 3. Navigation and information architecture

### 3.1 The metaphor

| Current tab (`tab` id) | RPG name | Metaphor | Bottom bar? |
|---|---|---|---|
| Today (`today`) | **Town** | Overworld + quest log for today: rituals, check-in, next quest, tonight's forecast | Yes |
| Plan (`quests`) | **Quest Board** | Bounties pinned to a board, grouped by Overdue / Today / This week / Later / Someday (existing groups) | Yes |
| (new, from `ext-saga.js`) | **Saga** | Chapter log, battle scene, past episodes | **Yes, center, raised** |
| Money (`money`) | **Shop** (Treasury + Merchant) | Real money ledger = Treasury; coin rewards = Merchant | Yes |
| Focus (`focus`) | **Dojo** | Sparring the training boss with focus sessions | Menu (plus the ▶ on quest rows already starts it via `q-focus`) |
| Squad (`squad`) | **Guild** | Party, raid, bounties (challenges), arena rank (league) | Menu |
| Coach (`coach`) | **Sage** | Wise NPC dialogue, journal as "Diary" | Menu |
| Hero (`hero`) | **Status** | Status screen, equipment, trophies | Menu (also tap the HUD portrait, as `hud()` already does) |
| Settings (currently bottom of Hero) | **Config** | Options menu | Menu |

**Keep the internal tab ids** (`today`, `quests`, `money`, ...). Many call sites hard-code them (`data-v="quests"` in `weeklyTeaser()`, `data-v="hero"` in `hud()`, `tab = 'quests'` after WOOP, `tab === 'today'` re-render checks in `ext-saga.js`). Only change labels and icons in `NAV`, and add one new id, `saga`.

### 3.2 Unify the bosses

- **Weekly boss = the Chapter Villain.** Same `WBOSSES` entry drives the Saga, the weekly objectives (`weeklyCard()`) and the Town forecast. Show it with one consistent sprite window and name plate everywhere. Its daily form (`SAGA_PHASES`: Scout → True Form) is the "phase" shown under its HP bar.
- **Focus boss = Dojo sparring partner.** Rename the framing ("Training Golem", "Sparring Slime") so it is clearly practice, not the story villain.
- **Raid boss = Guild raid.** Shared HP bar, party-sized.

### 3.3 Bottom bar: 5 slots, Saga in the middle

```
┌─────────────────────────────────────────────────────┐
│  ⌂        ☰         ╔═════╗        G         ≡      │
│ TOWN    QUESTS      ║ ⚔ ! ║      SHOP      MENU     │
│                     ║SAGA ║                         │
└─────────────────────╚═════╝─────────────────────────┘
```

- Five 20%-width slots, minimum 56px tall plus `--safe-b`. Labels 13px in the pixel font (up from ~10px).
- Saga slot is a raised window (`.win.px`, 8px above the bar) with a blinking `!` when an unread episode exists (`S.saga.eps[yesterday()]` and not `ep.seen`).
- MENU opens the main menu (3.4). Shop is in the bar, not Dojo, because logging spend is a 2-tap daily action; Dojo is reachable from quest rows. If Bryant uses Focus more than Money, swap those two: one line in `NAV`.
- Thumb reach: everything frequently tapped is in the bottom 40% of a 6.1" screen. Primary actions on Town (habit checkboxes) are full-width rows, so the right thumb reaches them anywhere.

```js
const NAV = [['today','⌂','Town'],['quests','☰','Quests'],['saga','⚔','Saga'],['money','G','Shop'],['menu','≡','Menu']];
```
```css
:root[data-skin="rpg"] nav{background:var(--line-dark);backdrop-filter:none;border-top:var(--px) solid var(--line)}
:root[data-skin="rpg"] nav button{min-height:56px;font:13px var(--font-ui);color:var(--dim)}
:root[data-skin="rpg"] nav button span{font:22px var(--font-ui);filter:none}
:root[data-skin="rpg"] nav button.on{color:var(--acc)}
:root[data-skin="rpg"] nav button.saga{transform:translateY(-8px)}
```

### 3.4 Main menu (the "home" of the game)

A FF-style pause menu: party on the left, commands on the right, gold/time strip at the bottom. It opens as a full-screen overlay from MENU, instantly (no slide), and is also what a first-time user sees after onboarding.

```
╔══════════════════════════╗╔════════════╗
║ ┌────┐ BRYANT            ║║ ▶ Status   ║
║ │ 🦊 │ Lv 7  Vanguard    ║║   Dojo     ║
║ └────┘ Bard (CHA)        ║║   Guild    ║
║ EXP ▰▰▰▰▰▰▰▱▱▱ 312/480    ║║   Sage     ║
║ HP  ▰▰▰▰▰▰▰▰▱▱ Energy 4  ║║   Chronicle║
║                          ║║   Config   ║
╚══════════════════════════╝║   Save     ║
╔══════════════════════════╗╚════════════╝
║ Chapter 12 · Hydra of    ║
║ Habits, the Warlord      ║
║ Odds tonight  40%        ║
╚══════════════════════════╝
╔═════════════╗╔═══════════╗
║ G    1,240  ║║ Day 18 🔥 ║
╚═════════════╝╚═══════════╝
```

- "Save" = existing export backup. "Chronicle" = past episodes list (moved out of `sagaSettings()`).
- On phones under 360px wide, the command window stacks below the party window.
- "HP" maps to today's energy check-in (`S.checkins[today()].energy`, 0 to 4). If not checked in, the bar shows "??" and tapping it opens the check-in. This turns the check-in into a natural RPG action ("check your HP").

---

## 4. Key screens (text wireframes)

All widths assume a 375px phone with 16px gutters.

### 4.1 Town (Today): overworld and quest log

Goal: cut the stack of ten cards to four windows, in a fixed order. The Saga goes first.

```
╔ BRYANT  Lv7 ══════════════ G 1,240 ╗   ← HUD (hud()), 1 line + EXP bar
║ EXP ▰▰▰▰▰▰▰▱▱▱          🎁×2      ║
╚════════════════════════════════════╝
╔ SAGA ══════════════════════════════╗   ← sagaCard(), unread state
║ ┌──────────── portrait ─────────┐  ║
║ │      (16-bit filtered)        │  ║
║ └───────────────────────────────┘  ║
║ EPISODE 12  "The Rain Duel"     !  ║
║ ⚔ SUCCESS · 14+2+4 = 20 vs DC 13   ║
║ ▶ Enter battle                     ║
╚════════════════════════════════════╝
╔ TONIGHT'S FORECAST ════════════════╗   ← sagaTonight(), FE-style
║ 🐍 Hydra of Habits · Warlord   DC14 ║
║ HIT  40%  ▰▰▰▰▱▱▱▱▱▱               ║
║ MOD  +2 CHA   ACT +3   CRIT 5%     ║
║ ▶ +1: 1 more ritual   ▶ +1: focus  ║   ← tappable "how to raise"
╚════════════════════════════════════╝
╔ TODAY'S RITUALS ═══════ 3/5 ═══════╗   ← habits, check-in folded in
║ HP ?? ▶ Check in (+10 EXP)         ║
║ [✓] 💧 Drink water     BODY  🔥4   ║
║ [ ] 📚 Read 10 pages   MIND        ║
║ [ ] 🚶 Walk 20 min     BODY  🔥2   ║
║ ＋ New ritual                       ║
╚════════════════════════════════════╝
╔ NEXT QUEST ════════════════════════╗   ← nextUpCard()
║ ⭐ Finish tax form       +50 EXP ▶  ║
╚════════════════════════════════════╝
  [ event log: money teaser, bills due, rest banner, slip card … ]
```

- Collapse `restBanner`, `slipCard`, `autoCard`, `stakeCard`, `moneyTeaser`, `nextBlockStrip`, `liteBanner`, `reviewCard`, `timeLeftCard` into one **Event log** window: one line each, newest first, like a JRPG message log ("A bill approaches: Rent, due Fri."). Each line keeps its existing `data-act`. Implement as a new hook `HOOKS['events']` returning `{icon, text, act}` objects; until ext files are migrated, keep rendering their cards below the log.
- The coach tip moves to the Sage, and appears on Town only as a one-line "Sage says…" in the event log.
- Habit row: the checkbox becomes a framed 36px box inside a 48px-tall row; done state shows a pixel check and the row dims to 60%. Stat tag becomes a 3-letter pixel label colored by stat (`BOD`, `MND`), at 14px.
- Forecast odds bar color comes from the existing thresholds in `sagaTonight()` (70/45) mapped to `--hp`, `--hp-low`, `--hp-crit`.
- "How to raise HIT" lines are computed from `actionBonus()` caps: show only bonuses not yet maxed (habits < 3, focus < 2, quests < 2, perfect, mood). Tapping scrolls to that ritual / starts focus / opens check-in.

### 4.2 Saga tab: Chapter log

```
╔ CHAPTER 3 · WEEK OF OCT 6 ═════════╗
║ Villain: 🐍 Hydra of Habits         ║
║ Phase  Mon Tue Wed Thu Fri Sat Sun ║
║        ⚔   ⚔   🛡   ⚔   ·   ·   ·  ║   ← outcome glyph per day
╚════════════════════════════════════╝
╔ EPISODES ══════════════════════════╗
║ ▶ Ep 12  The Rain Duel        ⚔    ║
║   Ep 11  Training Montage     🛡    ║
║   Ep 10  Oops, Natural One    🤡    ║
╚════════════════════════════════════╝
╔ TONIGHT'S FORECAST ════════════════╗  (same component as Town)
╚════════════════════════════════════╝
  ▶ Hero look · Names in stories · AI status   ← sagaSettings() moves here
```

### 4.3 The episode as a battle scene (replaces `sagaRead()`)

A full-screen overlay (`#battle`, sibling of `#modal`, not inside `#app` so `render()` cannot wipe it mid-scene). Four acts, driven by tap-to-advance. Every number is precomputed in `ep.check` (`d20`, `mod`, `bonus`, `total`, `dc`, `outcome`), so the scene is pure presentation.

**Act 0, encounter transition** (300ms, section 5.1), then:

**Act 1, encounter**

```
┌────────────────────────────────────┐
│  (portrait backdrop, dimmed 50%)   │
│                                    │
│               🐍                   │  ← boss sprite, 96px, 2-frame bob
│        HYDRA OF HABITS             │
│        Warlord · DC 13             │
│                                    │
╔════════════════════════════════════╗
║ The Hydra of Habits, Warlord form, ║  ← typewriter
║ blocks the road!                 ▼ ║
╚════════════════════════════════════╝
╔ BRYANT ═══════ Lv7 ╗╔ COMMAND ═════╗
║ HP ▰▰▰▰▰▰▰▱ 4/5    ║║ ▶ Fight      ║
║ CHA +2  Bard       ║║   Skills     ║
╚════════════════════╝║   Status     ║
                      ║   Flee       ║
                      ╚══════════════╝
```

Command mapping (all honest, none change the result):

| Command | What it does | Real data |
|---|---|---|
| **Fight** | Plays the turn: actions resolve, then the d20 roll | `ep.check` |
| **Skills** | Lists yesterday's actions as the skills that powered the roll: "Read 10 pages (MIND)", "Focus duel 50 min", "Perfect day +2" | `sagaDay(date)`: `habits`, `quests`, `focusMin`, `perfect`, `mood` |
| **Status** | Hero status at the time of the episode: level, gear, class | `ep.lv`, `sagaGear()`, `SAGA_CLASS` |
| **Flee** | Closes the scene ("You can rewatch from the Chronicle.") | `close` |

For a rest day (`outcome === 'rest'`): no boss, campfire scene, commands become **Rest / Status / Leave**.

**Act 2, the turn (Fight)**, each line typewritten, one tap per line:

```
║ Bryant used Read 10 pages!         ║
║ Bryant used Walk 20 min!           ║
║ Bryant used Focus Duel (50 min)!   ║
║ Action bonus  +4                   ║   ← number counts up in --acc
║ Charisma      +2                   ║
```
Cap the list at 4 lines plus "...and 3 more!" so it never drags.

**Act 3, the roll**

```
               ╱╲
              ╱  ╲
             ╱ 14 ╲         ← d20, numbers flicker ~1.1s, land on ep.check.d20
            ╱______╲
     14 + 2 + 4 = 20   vs  DC 13
           ⚔ SUCCESS!
               -20          ← damage number pops off the boss
```

```html
<div class="d20" role="img" aria-label="d20 rolled 14"><span class="face">14</span></div>
```
```css
.d20{width:120px;height:120px;margin:12px auto;display:grid;place-items:center;
  background:var(--acc);clip-path:polygon(50% 0,100% 28%,100% 72%,50% 100%,0 72%,0 28%);
  font:40px var(--font-ui);color:var(--line-dark)}
.d20.rolling{animation:d20-spin .12s steps(3) infinite}
@keyframes d20-spin{33%{transform:rotate(60deg) scale(.92)}66%{transform:rotate(120deg) scale(1.04)}}
.d20.land{animation:d20-land .35s steps(4)}
@keyframes d20-land{0%{transform:scale(1.4)}50%{transform:scale(.9)}100%{transform:scale(1)}}
.d20.nat20{background:var(--gold);box-shadow:0 0 0 4px var(--line-dark),0 0 0 6px var(--gold)}
.d20.nat1{background:var(--dim)}
```
```js
async function rollDie(el, final) {
  const face = el.querySelector('.face');
  if (rpgCalm()) { face.textContent = final; return; }
  el.classList.add('rolling'); const end = performance.now() + 1100;
  while (performance.now() < end) { face.textContent = 1 + Math.floor(Math.random() * 20); sfxTick(); await sleep(70); }
  el.classList.replace('rolling', 'land'); face.textContent = final;
  if (final === 20) el.classList.add('nat20'); if (final === 1) el.classList.add('nat1');
}
```
Caption under the die, in `--dim`: "The die was cast at dawn and can't be re-rolled." (This is already the rule in `sagaTonight()`; say it in the moment too.)

Outcome effects: critical → screen flash + boss knocked off-screen + fanfare; success → boss shake (existing `@keyframes shake`) + damage number; narrow → boss shake small, "MISS by 2!" in `--blue`; setback → hero window shakes, then "Training montage!"; fumble → sprite trip gag (rotate 90deg steps(2)) with "Oops!" bubble.

**Act 4, the episode (visual-novel pages)**

```
┌────────────────────────────────────┐
│     (portrait, full width, 16-bit) │
│                                    │
╔ NARRATOR ══════════════════════════╗
║ Fueled by three rituals, Bryant    ║
║ faced the Warlord in the rain…   ▼ ║
╚════════════════════════════════════╝
             ● ● ○ ○                    ← page dots
```
- Split `ep.story` on blank lines (already done in `sagaRead()`), one paragraph per page, typewriter on each.
- Story text uses `--font-text` at 18px, line-height 1.55, max 6 lines per page; long paragraphs scroll inside the window.
- After the last page: **Result window** (below), then the teaser in italics as "NEXT TIME…", then commands **Again** (replay from Act 1), **New picture** (existing `saga-repaint`), **Done**.
- A "Skip to text" link at the top right jumps to a plain reader (today's layout, restyled) for people who just want to read.

**Result window** (FF victory screen):

```
╔ VICTORY ═══════════════════════════╗
║ EXP gained     148                 ║   ← d.xp for that day (S.history[date])
║ Gold gained     52                 ║
║ Bryant  Lv 6 → Lv 7   LEVEL UP!    ║   ← d.lvBefore / d.lvAfter
║ Gear: leather armor → steel armor  ║   ← sagaGear() threshold crossed
╚════════════════════════════════════╝
```
For setbacks the title is "TRAINING" not "DEFEAT", in keeping with the existing "misses are training montages" rule in the `ext-saga.js` header.

Mark the episode seen (`ep.seen = true`) when the scene closes, which clears the `!` on the nav.

### 4.4 Boss encounter on the Quest Board (weekly objectives)

`weeklyCard()` becomes a boss window with objectives as its "weak points":

```
╔ CHAPTER VILLAIN ═══════ 3 days left╗
║            🐍                       ║
║      HYDRA OF HABITS               ║
║ HP ▰▰▰▰▰▱▱▱▱▱▱▱  42%               ║
║ ─ Weak points ──────────────────── ║
║ ✓ Rituals      18/15   ▶ Claim     ║
║ · Perfect days  2/3                ║
║ · Check-ins     4/5                ║
╚════════════════════════════════════╝
```
Claiming an objective plays a mini hit (boss shake + damage number), using the same component as the battle scene.

### 4.5 Status screen (Hero)

```
╔ STATUS ════════════════════════════╗
║ ┌──────┐ BRYANT                    ║
║ │ 🦊   │ Lv 7  Vanguard            ║
║ │      │ Class: Bard               ║   ← SAGA_CLASS[top stat]
║ └──────┘ EXP 2,312   NEXT 168      ║
╚════════════════════════════════════╝
╔ ATTRIBUTES ════════════════════════╗
║ STR  4  +2  ▰▰▰▰▱▱▱▱   Body        ║   ← SAGA_ABILITY + statLevel + abilityMod
║ INT  6  +3  ▰▰▰▰▰▰▱▱   Mind        ║
║ WIS  3  +1  ▰▰▰▱▱▱▱▱   Spirit      ║
║ DEX  2  +1  ▰▰▱▱▱▱▱▱   Craft       ║
║ CHA  5  +2  ▰▰▰▰▰▱▱▱   Social      ║
║ LCK  3  +1  ▰▰▰▱▱▱▱▱   Wealth      ║
╚════════════════════════════════════╝
╔ EQUIPMENT ═════════════════════════╗
║ Armor  Reinforced steel, flowing   ║   ← sagaGear(level())
║        cape                        ║
║ Next   Silver plate at Lv 10       ║
╚════════════════════════════════════╝
╔ RECORDS ═══════════════════════════╗
║ This week  EXP 640 · Rituals 28    ║   ← weekSummary()
║ [12-week heatmap, square cells]    ║   ← heatmap(), radius 0
╚════════════════════════════════════╝
  ▶ Trophies (12/30)   ▶ Skills   ▶ Portraits
```
- The radar chart becomes optional (a "Chart" toggle inside Attributes). The bar list is easier to read and more JRPG.
- Achievements become **Trophies**, in a 4-column grid of framed squares; locked ones show `?`.
- Avatar picker becomes **Portraits**. Settings move to Menu > Config.

### 4.6 Shop (Money): Treasury + Merchant

Rule: **real money is never shown with the coin "G" symbol.** Real money stays `S.money.cur` (`$`), game coins are `G`. Mixing them would be confusing and a bit irresponsible.

```
 [ TREASURY ]  [ MERCHANT ]                  ← two-tab header, pixel font
╔ TODAY'S PURSE ═════════════════════╗
║ Safe to spend      $42.10          ║   ← allowance().safe
║ ▰▰▰▰▰▰▱▱▱▱  $18 of $60 spent       ║
╚════════════════════════════════════╝
╔ QUICK LOG ═════════════════════════╗
║      [   $  0.00   ]               ║
║ ▶ Food  Trans  Home  Fun  …        ║
║ ▶ Log it            No-spend day   ║
╚════════════════════════════════════╝
╔ POUCHES ═══════════════════ (HP) ══╗   ← envelopes as HP bars
║ 🍔 Food     $112/$300  ▰▰▰▰▱▱▱▱    ║
║ 🎮 Fun       $5/$60    ▰▱▱▱▱▱▱▱ !  ║   ← hp-crit blink when < 15%
╚════════════════════════════════════╝
╔ HOARD ═════════════════════════════╗   ← savings goal, dragon's hoard
╚════════════════════════════════════╝
```

Merchant tab (moved from `viewHero()`'s reward shop):

```
╔ MERCHANT ══════════════ G 1,240 ═══╗
║ "Welcome, traveler!"               ║
║ ▶ Mystery chest            60 G    ║
║   Movie night             300 G    ║
║   New book                500 G    ║
╚════════════════════════════════════╝
╔ ═══════════════════════════════════╗
║ Buy Movie night for 300 G?         ║   ← confirm window, Yes/No commands
║   ▶ Yes     No                     ║
╚════════════════════════════════════╝
```

### 4.7 Guild (Squad): the party

```
 [ PARTY ] [ BOUNTIES ] [ ARENA ]           ← board / challenges / league
╔ GUILD RAID ════════════ 3 days ════╗
║            🗿                       ║
║ THE IRON COLOSSUS                  ║
║ HP ▰▰▰▰▰▰▱▱▱▱  1,820 / 3,000       ║
║ Every EXP the party earns is damage║
╚════════════════════════════════════╝
╔ PARTY ═══════════ This week ▾ ═════╗
║ 1 🦊 Bryant   Lv7   640 EXP  (you) ║
║   ▰▰▰▰▰▰▰▰▱▱                       ║
║ 2 🐱 Mia      Lv5   512 EXP   👏   ║
║   ▰▰▰▰▰▰▱▱▱▱                       ║
╚════════════════════════════════════╝
```
- Party rows reuse the `.gauge` component: each member's week XP as a bar relative to the leader, like party HP in a battle menu.
- Cheer button (`cheer`) becomes a 44px framed "👏" command.
- Challenges = **Bounties** (posted by a guild member, reward listed like a quest reward). League divisions = **Arena rank** (Bronze → Legend already exists in `DIVS`).
- The focus room (`roomCard()` from `ext-life.js`) shows as "Training in the Dojo now: Mia (12 min left)".

### 4.8 Dojo (Focus) and Sage (Coach), briefly

- **Dojo:** keep the SVG ring timer but make it square-capped, use `--acc` stroke, and put the time in the pixel font at 48px. The sparring boss window above uses the same HP gauge. "Attack" stays the start button (`focus-start` already says "⚔️ Attack").
- **Sage:** chat bubbles become dialogue windows with a name plate (`SAGE` / `BRYANT`), sage portrait `🧙` in a sprite frame. Only the *newest* bot reply typewrites. Quick prompts (`.qp`) become a command list. Journal = **Diary**.

---

## 5. Motion and feedback

### 5.0 The rule that makes motion work here

`render()` rebuilds `#app` on nearly every action. So:
- **Never put entrance animations on elements inside `#app`.** They would replay on every habit tap.
- One-shot effects (damage numbers, flashes, transitions, the battle scene) live in **fixed layers outside `#app`**: `#fx` (canvas, exists), `#toasts` (exists), plus new `#fxl` (DOM effects layer) and `#battle`.
- Looping idle animations (boss bob, cursor bob) are fine inside `#app` because restarting a loop is invisible.

```html
<!-- index.html additions -->
<div id="fxl" aria-hidden="true"></div>
<div id="battle" class="hidden" role="dialog" aria-modal="true" aria-label="Saga episode"></div>
```

### 5.1 Battle transition

Classic horizontal-bar wipe, 360ms total, pure CSS:

```css
#fxl{position:fixed;inset:0;pointer-events:none;z-index:80}
.wipe{position:fixed;inset:0;display:grid;grid-template-rows:repeat(8,1fr);z-index:85}
.wipe i{background:var(--line-dark);transform:scaleX(0);animation:wipe .36s steps(6) forwards}
.wipe i:nth-child(odd){transform-origin:left} .wipe i:nth-child(even){transform-origin:right}
.wipe i:nth-child(n){animation-delay:calc(var(--n) * 25ms)}
@keyframes wipe{to{transform:scaleX(1)}}
```
```js
function battleWipe() { return new Promise(r => { if (rpgCalm()) return r();
  const w = document.createElement('div'); w.className = 'wipe';
  w.innerHTML = Array.from({ length: 8 }, (_, i) => `<i style="--n:${i}"></i>`).join('');
  $('#fxl').append(w); setTimeout(() => { r(); w.remove(); }, 420); }); }
```
Show the scene under the bars, then remove them. Use the same wipe in reverse when closing.

### 5.2 Damage / gain numbers

When a habit is checked, a quest completed, money logged: pop "+12 EXP" from the tapped row.

```js
function popNum(fromEl, text, cls = '') {
  if (!fromEl) return; const r = fromEl.getBoundingClientRect(), n = document.createElement('div');
  n.className = 'pop ' + cls; n.textContent = text; n.style.left = (r.right - 70) + 'px'; n.style.top = (r.top + 4) + 'px';
  $('#fxl').append(n); setTimeout(() => n.remove(), 900);
}
```
```css
.pop{position:fixed;font:20px var(--font-ui);color:var(--acc);
  text-shadow:2px 0 var(--line-dark),-2px 0 var(--line-dark),0 2px var(--line-dark),0 -2px var(--line-dark);
  animation:pop-up .9s steps(9) forwards}
.pop.hp{color:var(--good)} .pop.dmg{color:var(--txt)}
@keyframes pop-up{0%{transform:translateY(6px)}20%{transform:translateY(-10px)}100%{transform:translateY(-34px);opacity:0}}
```
Capture the element rect *before* `toggleHabit()` calls `render()` (the `A.habit` handler receives `el`, so wrap it: `habit: el => { const r = el; toggleHabit(el.dataset.id); popNum(r, ...) }` with the rect read first). The existing `toast('+N XP')` in `award()` can then be suppressed when a pop was shown, to avoid double feedback.

### 5.3 Level-up fanfare

Replace the generic `levelUp()` modal with an FF-style window:

```
╔════════════════════════════════════╗
║        ★  LEVEL UP!  ★             ║
║ Bryant is now Lv 8                 ║
║ Title   Challenger → Vanguard      ║
║ CHA     4 → 5                      ║   ← stat levels that changed since last level
║ New portrait: 🦉                    ║
║                         ▶ OK       ║
╚════════════════════════════════════╝
```
- Lines appear one by one (typewriter, 150ms apart), square-wave fanfare, 3-frame screen flash (`#fxl` white div, opacity 0.6 → 0 in `steps(3)`).
- Keep `confetti()` but recolor to palette tokens read via `getComputedStyle`, and draw squares only (already does `fillRect`) with no rotation for a pixel look.

### 5.4 Other moments

| Event | Effect |
|---|---|
| Chest open (`chest` action) | Chest sprite shakes 3 frames, then "Obtained 40 G!" message window |
| Perfect day | Gold border flash on the Rituals window + "PERFECT!" pop |
| Weekly objective claim | Boss shake + damage number on the villain window |
| Boss HP < 25% | HP bar `hp-crit` blink |
| New episode ready | Nav Saga slot `!` blinks (`steps(2)`), toast becomes "A new chapter awaits!" |
| Tab change | Instant cut. No slide. (Retro menus cut.) |

### 5.5 Reduced motion and calm mode

There is currently no `prefers-reduced-motion` handling, and `S.settings.calm` only stops confetti. Make them one switch:

```js
const rpgCalm = () => S.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('calm', rpgCalm());   // call in render()
```
```css
.calm *,.calm *::before,.calm *::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important}
@media (prefers-reduced-motion: reduce){ *,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important} }
```
In calm mode: typewriter prints instantly, the d20 shows the final face immediately, wipes are skipped, damage numbers appear and fade without moving, no screen flash, no blinking (blinking also matters for photosensitivity, keep all blinks at or under 2Hz regardless).

---

## 6. Accessibility and performance on phones

### 6.1 Accessibility checklist

- **Contrast:** all text pairs ≥ 4.5:1 (body) and ≥ 3:1 (24px+ numbers). Verify `--dim` on `--win-bot` in both themes. Never put meaning in color alone: outcomes always carry a word ("SUCCESS") and a glyph.
- **Targets:** ≥ 44x44px for everything tappable. Today `.del` (≈36px), `.btn.sm` (≈32px tall), `.avs button` (48px, OK), `.moods button` (≈46px, OK). Fix:
  ```css
  :root[data-skin="rpg"] :is(.del,.btn.sm,.pills button,.seg button,.qp button){min-height:44px;min-width:44px}
  ```
- **Font sizes:** body 16px system font; pixel font ≥ 16px; secondary text ≥ 14px. Respect user zoom: the viewport meta has no `maximum-scale`, keep it that way. Use `rem` so OS text-size scaling works.
- **Keyboard and screen readers:** a menu-driven UI must be operable as one.
  - Clickable `div.task[data-act]` rows need `role="button" tabindex="0"`; add one global handler: `keydown` Enter/Space on `[data-act]:not(button)` → same dispatch as click.
  - Command windows: `role="menu"` / `menuitem`, arrow keys move focus (and the cursor follows `:focus-visible`), Escape = Flee/close.
  - Battle scene: `role="dialog" aria-modal="true"`, focus moves to the first command on open and returns to the Saga card on close. Message window has `aria-live="polite"` and typewriter text uses `aria-label` with the full line (see 2.7).
  - The d20 has `role="img" aria-label="d20 rolled 14"` set only after it lands.
  - Pixel-font labels that are abbreviations (`STR`, `HP`) get `<abbr title="Strength">` or visually hidden full words.
- **Readable mode:** a Config toggle "Retro font for labels" (default on). Off = every `--font-ui` falls back to `--font-text`, keeping frames and colors. Some people with dyslexia find pixel fonts hard; this costs one CSS variable.
- **Sound** off by default for new profiles; never auto-play; haptics already separately toggleable.

### 6.2 Performance budget

| Item | Budget | Notes |
|---|---|---|
| Font | ≤ 45 KB woff2, 1 file | Latin subset, `font-display: swap`, cached by SW |
| New CSS | ≤ 12 KB | `theme-rpg.css`, unminified is fine |
| New JS | ≤ 15 KB | `ext-rpg.js` (helpers, menu, pops) + battle scene in `ext-saga.js` or `ext-battle.js` |
| Images | 0 new | Frames, cursor, bars, d20 are CSS; icons are glyphs or inline SVG |
| Audio | 0 bytes | Synthesized via existing `tone()` |

Also:
- **Remove** `backdrop-filter: blur(14px)` on `nav` and the `fixed` body gradient in the RPG skin: both are expensive on mid-range Android.
- Animate only `transform` and `opacity`; `steps()` timing means fewer distinct frames.
- The 16-bit portrait filter runs once per image and is cached; the full-size SD image is still loaded once.
- The battle scene builds its DOM once on open and mutates text in place. It must not call `render()` while open. Note that `sagaGenerate`/`sagaPaint` call `render()` from async callbacks; that is harmless because `#battle` lives outside `#app`.
- Typewriter and dice loops use `requestAnimationFrame`/short `sleep`, and stop when the scene closes (check a `battleOpen` flag each step).

---

## 7. Implementation plan

Each phase is independently shippable, reversible, and touches as few existing lines as possible. The skin is behind `<html data-skin="rpg">` until Phase 3, so the old look remains one toggle away.

### Phase 0: groundwork (½ day)

- `defaults().settings.sound = false` (new profiles only).
- Add `rpgCalm()` and the `calm` class toggle in `render()`; add the reduced-motion CSS block to `style.css`.
- Add `#fxl` and `#battle` containers to `index.html`.
- Global keyboard handler for `[data-act]` divs; `role="button" tabindex="0"` on `.task` rows that have `data-act` (template edit in `habitRow`, `questRow`, teasers).
- **Ship check:** app looks identical; reduced-motion users get no confetti.
- **Risk:** low. `migrate()` merges settings so existing users keep `sound: true`.

### Phase 1: theme layer (1 day)

- New `public/theme-rpg.css` with the tokens (2.2), `@font-face` (2.3), and window/button/bar/nav restyles (2.4 to 2.6) that only target existing classes (`.card`, `.task`, `.btn`, `.bar`, `.chip`, `.stat`, `.badge`, `nav`, `#modal .sheet`).
- `public/fonts/PixelifySans-Latin.woff2` (download from the Google Fonts GitHub repo, OFL; include `OFL.txt` next to it).
- Load both in `index.html`; `sw.js`: add to `SHELL`, bump `CACHE` to `lifequest-v4`.
- Config toggle "Skin: Classic / 16-bit" and "Theme: Auto / Dark / Light" that sets `data-skin` / `data-theme` on `<html>` (store in `S.settings.skin`, `S.settings.theme`) and updates `meta[name=theme-color]`.
- **Ship check:** flip the toggle, every tab is reskinned; the classic skin is untouched.
- **Risks:** (a) Hard-coded inline hex (section 1, item 7) leaves purple islands: radar, focus ring, `sagaImgTag` placeholder, confetti. Accept for this phase. (b) Inline `style="border-radius:14px"` in `sagaImgTag()` will stay round. (c) Stale SW cache on phones: the network-first SW mostly handles it, but test with cleared caches (see project memory).

### Phase 2: component restyle and de-hardcoding (1 to 2 days)

- Replace hard-coded colors in JS templates with tokens or classes: `radar()` → `stroke="var(--line)"` etc. (SVG presentation attributes accept `var()` via `style`), `viewFocus()` ring, `sagaImgTag()` placeholder → `.portrait-slot` class, `confetti()` reads tokens.
- Add the reusable pieces as CSS + tiny helpers in a new `public/ext-rpg.js` (loaded before `ext-saga.js`): `.win-title`, `.cmds/.cmd`, `.gauge`, `.sprite`, `typeInto()`, `popNum()`, chiptune `sfx` additions.
- Stat tags to 3-letter pixel labels; habit checkbox restyle; 44px target fixes.
- Damage numbers on habit/quest/money actions (5.2).
- **Ship check:** both skins still work; no inline hex remains in `public/*.js` (grep `#[0-9a-f]{3,6}` in templates).
- **Risk:** medium. Touches many template strings in `app.js`. Do it file by file, and diff screenshots per tab (the `docs/screenshots` set is a good baseline).

### Phase 3: navigation and IA (1 to 2 days)

- New `NAV` (3.3) with labels/icons only; keep tab ids. Add `saga` view (`viewSaga()` in `ext-saga.js`: chapter strip, episode list, forecast, settings moved from `sagaSettings()`).
- `menu` opens the main menu overlay (3.4), listing Status, Dojo, Guild, Sage, Chronicle, Config, Save. Config is the settings block lifted out of `viewHero()` into `viewConfig()`.
- Town: reorder (Saga first, forecast, rituals, next quest), add the **Event log** hook and move the coach tip there; Shop gains the Treasury/Merchant switch (Merchant = reward shop moved from Hero).
- Make the 16-bit skin the default for new profiles once this phase feels right.
- **Ship check:** every old destination reachable in ≤ 2 taps; all `data-act="tab"` links still land correctly.
- **Risks:** (a) Muscle memory: Bryant loses one-tap Focus/Coach/Hero. Mitigate with the HUD portrait → Status shortcut that already exists and quest-row ▶ → Dojo. (b) Ext files that push cards into `HOOKS.today` (`timeLeftCard`, `liteBanner`, `reviewCard`) need migrating to the event log one by one; until then they render below it, which is fine. (c) `tab === 'today'` checks in `ext-saga.js` should also re-render when `tab === 'saga'`.

### Phase 4: Saga forecast and episode card (1 day)

- `sagaTonight()` → FE-style forecast window (HIT / MOD / ACT / CRIT + "how to raise" commands, 4.1).
- `sagaCard()` → framed portrait with 16-bit filter (2.10), unread `!`, "Enter battle" command. Track `ep.seen`.
- Chapter strip on the Saga tab from `S.saga.eps` for the current week.
- **Ship check:** odds still match `sagaOdds()` exactly; screen reader reads "Hit chance 40 percent".
- **Risk:** low. Pure presentation over existing data.

### Phase 5: the battle scene (2 to 3 days)

- `sagaBattle(date)` replaces `sagaRead()` as the default action for `saga-read`; keep the old reader as "Skip to text".
- Implement Acts 0 to 4 (4.3): wipe, encounter, commands (Fight / Skills / Status / Flee), action lines, `rollDie()`, outcome effects, VN pages with `typeInto()`, result window, teaser, replay.
- Focus management, Escape to close, `aria-live` message window, calm-mode fast path.
- **Ship check:** watch a critical, a success, a setback, a fumble and a rest day (seed test dates via a dev-only helper or by temporarily editing `S.saga.eps[date].check` in the console on a throwaway profile, then delete the `data/` folder after, per project testing notes).
- **Risks:** (a) Async state: `sagaGenerate()` may finish and `render()` while the scene is open; because `#battle` is outside `#app` it survives, but guard against opening two scenes. (b) Long AI stories: cap per-page lines and allow scroll inside the window. (c) Perceived dishonesty of the cycling dice: keep the "cast at dawn" caption. (d) Phones with small heights (SE, 667px): the command window and message window must fit; use `100dvh` and let the portrait shrink first.

### Phase 6: feedback polish (1 day)

- Level-up window (5.3), chest window, perfect-day flash, boss shake on objective claim, nav `!` blink, chiptune sfx set.
- Status screen (4.5) with attribute bars, equipment from `sagaGear()`, trophies grid.
- Guild party gauges (4.7), Sage dialogue windows (4.8).
- **Risk:** scope creep. Each item is independent, ship them one at a time.

### Phase 7 (optional): extras

- Inline SVG pixel icon sprite for nav and menu (replace glyphs).
- Additional window themes in Config ("FF blue", "DQ black", "Parchment"), each just a different token block.
- Pixel-art frame around the Saga portrait that changes with gear tier.
- Ship a `docs/screenshots/rpg-*.jpg` set for before/after.

### Global risks

| Risk | Mitigation |
|---|---|
| Pixel font hurts readability | Pixel font only for chrome; story/chat in system font; "Retro font" toggle |
| Theme work fights ~190 inline styles | Phase 2 de-hardcodes colors; leave layout-only inline styles alone |
| Animations replaying on every `render()` | All one-shots live in `#fxl` / `#battle`, outside `#app` (5.0) |
| Offline shell missing new files | Update `SHELL` and bump `CACHE` every phase that adds a file |
| Removing tabs hides features | Main menu reaches everything in 2 taps; HUD and quest-row shortcuts |
| Over-gamifying money | Real currency never shown as `G`; Treasury copy stays factual; no "damage" language on overspending (matches the existing "no penalty" copy in `viewMoney()`) |
