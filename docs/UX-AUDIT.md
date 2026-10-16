# LifeQuest UX audit and Town redesign

Evidence comes from measuring the running app at 375x812 (iPhone-class) and computing contrast ratios. Interactive preview of the proposed Town screen: [town-redesign-preview.html](town-redesign-preview.html).

## 1. UX audit and friction points

| # | Problem | Evidence (measured) | Why it hurts |
|---|---|---|---|
| 1 | **The daily job is buried.** The reason people open the app (tick rituals, check in) sits below two large Saga windows. | Town is **2.9 screens tall**. Daily check-in starts **1,513px** down and the habit list **1,761px** down (about 2.2 screens). Above the fold: status, the episode card, the forecast. | The most frequent action takes 2+ scrolls every day. The story is the reward, so it should not stand between the user and the action that earns it. |
| 2 | **No priority: 12 equal-weight windows on Town.** Every card has the same frame, so nothing reads as primary. | 12 `.card`/`.task` windows on Town, 14 on Money, 13 on Hero. | Equal frames mean equal visual weight. Scanning cost grows with every card (Hick's law). |
| 3 | **Duplicated information.** The episode card and the full forecast appear on both Town and the Saga tab. | `sagaCard()` renders on both screens; the forecast adds ~400px each time. | Two big copies of the same card push real content down and make the Saga tab feel redundant. |
| 4 | **Tap targets under 44px** (Apple HIG 44pt, Material 48dp). | Money: **13** targets at 40px (Spent/Income, every category button, Show amount). Hero: 7. Town: "Enter battle" and "Another tip" at 40px. | Category buttons are used every time money is logged. Missed taps on a phone are the fastest way to lose trust in a tracker. This one is my own mistake: I set the 16-bit buttons to a 40px minimum. |
| 5 | **Dim text fails AA on the window gradient.** | `--dim` (#b9c3ff) is 6.94:1 on the window middle but **4.37:1 on the lighter top of the gradient** (#2f45c9). AA needs 4.5:1 for normal text. Captions under window titles sit exactly there. | Secondary text (the cue for what a number means) is hardest to read in bright light. |
| 6 | **Discoverability gaps (judgement, from walking the flow).** Saga is off until found; Nudges only appear in Config after Reminders are turned on (Menu, Config, Reminders, Nudges); the welcome screen does not mention the story or notifications. | Not a measurement: I traced the path in the app. | The two features meant to bring people back are the hardest to find. |

## 2. Design strategy and rationale

**Direction: keep the 16-bit identity, but make the structure calmer.** The retro look is a strength. The problem is how much of it is on screen at once.

- **One primary task per screen.** Town leads with *Today's rituals* (the job), with the Saga compressed to one window of two tappable rows (episode ready; tonight's odds). Quest, bill and coach-tip cards fold into a single collapsed "More today" group. Expected result: Town in about one screen (the preview is 805px tall).
- **Spacing scale: 4 / 8 / 12 / 16 / 24.** Rows are 56px with a 44px control inside; sections are separated by a 12-16px gap and a small gold label rather than a heavier frame.
- **Type scale: 13 (caption, pixel font) / 16 (body) / 18 (row titles) / 22 (screen titles).** The pixel font stays on section labels and numbers. Row titles, buttons and captions with more than a couple of words use the system font, so scanning stays fast. (Pixelify Sans is not installed yet; today every "pixel" label is a monospace fallback, which is wider and slower to scan.)
- **Platform conventions kept:** a bottom tab bar with 5 items (within iOS and Material limits), 44pt+ targets, the system back behaviour on the Menu sub-screens, no floating action button. The raised Saga tab is the one deliberate departure from stock patterns.
- **Colour and states (dark and light).** Night stays, with `--dim` raised to `#d2d9ff` (5.37:1 on the lightest gradient stop, 11.1:1 on the darkest). States use colour and shape together (green tile plus a tick plus strike-through for done). Focus is a 2px dashed gold outline. The existing calm mode and `prefers-reduced-motion` handling stay as they are.
- **Light theme: replace Parchment.** The brief rules out cream backgrounds, and Parchment (#e9dcb8 and #fbf3dc) is exactly that. Proposed **Daylight**, a cool light theme: background `#eef2fb`, surface `#ffffff`, text `#14183a` (15.3:1), dim `#475079` (7.0:1 on the background), button `#2639b8` with white text (8.9:1), success `#0b7a3e` (5.4:1), warning `#8a5a00` (5.9:1). All computed, not eyeballed.

## 3. Redesigned layout and component spec (Town)

Order, top to bottom (see the preview for working markup and CSS tokens):

1. **Status strip** (56px, one window): avatar 40px, name, level, XP gauge, gold chip.
2. **Today's rituals** (the primary list): label with live `done/total`; 56px rows with a 44px checkbox (`role="checkbox"`, `aria-checked`), a 3-letter stat tag, strike-through when done. The mood check-in becomes five 48px emoji buttons at the bottom of this window, so it is one tap, in context.
3. **The Saga** (one window, two 64px tappable rows): *episode ready* (title, NEW marker) and *Tonight: 45%* with the live hint ("1 more ritual lifts it to 50%"). Tapping opens the battle scene or the full forecast on the Saga tab. The big forecast window stays on the Saga tab only.
4. **More today** (collapsed `<details>`, count badge): next quest, bills due, Sage tip, rest-mode and slip cards.
5. **Bar** unchanged (5 slots, raised Saga), with 13px labels.

Other screens, same rules: Money quick-add to 48px controls and a collapsed "Envelopes" window; Hero's long list becomes Status, Trophies and Portraits with the reward shop moved to Shop (already planned as Merchant).

Discoverability fixes: (a) a one-time prompt after the first ritual: "Turn on the daily story?", (b) Nudges shown directly under the Reminders toggle in Config instead of a separate card, (c) a first-run line on the welcome screen about the story and gentle reminders.

## 4. What I could not confirm

- **Your brief had unfilled placeholders** (audience, goal, platform). I assumed: you and a few friends, on a mix of iPhone and Android home-screen apps; the goal is quick daily habit/task logging, with the Saga as the reward that brings people back.
- **Measurements are from the test hero at 375x812** in the in-app browser, not a real phone. Town's height depends on how many cards show for a given user (bills, rest mode, stakes); a fresh profile is shorter and a busy one is longer.
- **I have not run usability tests with anyone.** Problem 6 and the claim that monospace slows scanning are judgement, not data.
- **The preview is a static mock**, not wired to real data, and has not been tried on an iPhone or Android phone.
- **The pixel font is not installed**, so the real look differs from the final one. The contrast numbers use the current fallback-independent colours only.
- **Not confirmed:** whether the raised Saga tab is easy to hit one-handed on a large phone; I kept it from the original plan without testing it.

## Outcome (built and re-measured)

| Check | Before | After |
|---|---|---|
| Town height (375x812) | 2.9 screens, 12 windows | **1.3 screens**, habit list at 143px (was 1,761px) |
| Money / Hero height | 3.4 / 3.9 screens | **2.4 / 1.8** (lower sections fold into titled rows that remember their state) |
| Tap targets under 44px | 13 on Money, 7 on Hero, 2 on Town | **0 on every screen** (scanned: Town, Saga, Quests, Shop, Menu, Status, Dojo, Guild, Sage, Config, plus the level-up window) |
| Text under AA contrast | Night "dim" captions 4.37:1 on the top of the window gradient | **0 failures in Night and in Daylight** (automatic scan; the scanner was checked against the old colour, which it flags at 4.37) |
| Light theme | Parchment (cream) | **Daylight** (cool, high contrast) |

Not covered by the scan: the first-run welcome sheet, the battle scene (always the dark window look), active Focus timer states, and any screen with data I did not create. The scan reads colours from computed styles, so text over images is not checked.
