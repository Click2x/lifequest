# What People Wish Apps Like This Would Do

*A research-backed wish list for LifeQuest: real complaints and requests from habit, budgeting and planning app users, mapped to what the app does today and what to build next.*

> **Evidence quality: read this first.** Reddit blocked direct access during research, so I could not read raw threads. What I could use, strongest first:
> **(A)** peer-reviewed or university studies; **(B)** public vote counts and forum threads (Lunch Money's feedback board, a Mint-shutdown forum thread, a budgeting-app forum); **(C)** blog/roundup/review-aggregator summaries of user complaints, which are *secondary* and often written to sell apps. Each item below is tagged A/B/C so you can weigh it. Quotes are paraphrased.

Legend: ✅ built · 🟡 partly built · ❌ not built · Effort: S (hours) · M (a day) · L (multi-day, or needs your phone to verify)

---

## Build status (updated)

| # | Wish | Status |
|---|---|---|
| 1 | Streaks without shame | ✅ grace days, rest mode, **consistency rhythm**, Second Wind perk |
| 2 | Never lose my data | ✅ daily server **snapshots** + restore dialog |
| 3 | "3× a week" habits | ✅ weekly frequency with weekly streaks |
| 4 | Leave and return without guilt | ✅ **welcome back + lite week**, rest mode, graduate |
| 5 | Game that doesn't go stale | ✅ **skill tree** (new perks as you level) + calm mode; seasonal events still open |
| 6 | What works for *me* | ✅ private **pattern insights** (correlations, with caveats) |
| 7 | Body doubling | ✅ squad **focus rooms** (+10% XP) |
| 8 | Tasks + time in one view | ✅ timeline + **.ics import/export**, ⏰ reschedule, **Fit my day**; drag-and-drop skipped on purpose (tap-to-move works better on phones) |
| 9 | Time blindness | ✅ time-left bar, countdown strip, escalating late reminder |
| 10 | Reminders that arrive | ✅ snooze, mute, caps, quiet hours, and **server push for a closed app** (delivery to real phones not yet verified; see README) |
| 11–12 | Recurring tasks / overdue without shame | ✅ |
| 13 | Help me start | ✅ tiny first step + 5-minute start |
| 14 | Realistic estimates | ✅ learns your multiplier from timed quests |
| 15 | Bank import without passwords | ✅ CSV import + rules. Live bank sync deliberately not built |
| 16 | Real envelope budgeting | ✅ rollover, move money, to-be-budgeted |
| 17 | Irregular income | ✅ baseline + tax reserve |
| 18 | Split transactions | ✅ |
| 19 | Subscriptions and fees | ✅ repeating-charge detection, price-increase flag, month-over-month |
| 20 | Net worth | ✅ manual accounts + trend |
| 21 | Privacy | ✅ app-lock PIN + hide amounts |
| 22 | Weekly review | ✅ |
| 23 | Household/partner mode | ❌ not built (demand unconfirmed) |

---

## 1. Habits & motivation

### 1. Streaks that don't shame me ✅ 🟡
- **What people say:** Users describe breaking a streak as feeling worse than never starting; some log habits they didn't do just to keep the number alive. A study of **58,881 posts about five fitness apps** found shame, guilt and burnout tied to **lost streaks, nagging reminders and rigid targets**. *(A: [UCL/Loughborough via Earth.com](https://www.earth.com/news/why-fitness-apps-might-be-harming-your-health/), [Newsweek](https://newsweek.com/fitness-apps-study-says-they-can-do-more-harm-than-good-10913928); C: [streak-anxiety roundup](https://habitdoom.com/blog/streak-anxiety-habit-trackers))*
- **LifeQuest today:** grace-day streaks, rest mode, kind recovery messages, calm mode.
- **Next (S):** show a *consistency rhythm* ("5 of the last 7 days") next to or instead of the streak number, as an option.

### 2. Never lose my data ✅ 🟡
- **What people say:** Reviews repeatedly describe 60+ day streaks vanishing after a reinstall, restore or sync glitch. *(C: [habit-app review roundup](https://unstar.app/blog/streaks-habitica-way-of-life-strides-habit-tracking-apps-ranked-2026))*
- **Today:** self-hosted sync, rolling server backup, JSON export.
- **Next (S):** a "restore from server backup" button and automatic daily snapshots.

### 3. Habits that fit real life: "3× a week," not fixed days ❌
- **What people say:** "Customization limits that make habits feel mismatched to real life" is a recurring complaint cluster. *(C: same roundup)*
- **Today:** pick days of the week only.
- **Next (M):** flexible frequency (X per week/month) with a progress ring, and streaks counted in weeks.

### 4. Let me leave and come back without guilt ✅ 🟡
- **What people say:** Self-trackers lapse and resume constantly; abandonment isn't always failure, as people also stop because they've **learned** what they needed. Design should support "happy abandonment" and re-engagement without nagging. *(A: [Epstein et al., Beyond Abandonment](https://pmc.ncbi.nlm.nih.gov/articles/PMC5428074/); [Lived Informatics model](https://library.selfresearch.org/research/a-lived-informatics-model-of-personal-informatics/))*
- **Today:** rest mode, graduating automatic habits.
- **Next (S):** a "welcome back" screen after several days away that offers a *lite mode* (track just one habit this week).

### 5. Don't let the game get stale ❌ 🟡
- **What people say:** Gamification boosts engagement early, then drops after a few weeks (novelty effect); "gamification fatigue" and notification overload appear in Habitica reviews. *(A: [Tsay et al. novelty effect](https://gala.gre.ac.uk/id/eprint/19946/); C: [Habitica review analysis](https://kimola.com/reports/transform-your-productivity-with-habitica-insights-app-store-us-156491))*
- **Today:** calm mode (turns off confetti), seasonal leagues and weekly bosses.
- **Next (M):** new mechanics that unlock at levels (skill tree, themed monthly events) so the game *evolves*.

### 6. Tell me what actually works for *me* ❌
- **What people say:** People abandon trackers when the data isn't useful or only highlights shortcomings. The fix is insight that's actionable and kind. *(A: Epstein et al., above)*
- **Next (M):** private, gentle correlations from your own data: "On days you walked, your mood averaged 4.1 vs 3.2," "You focus longest in mornings." No judgment language.

### 7. Body-doubling / working alongside others ❌
- **What people say:** ADHD-oriented tools list body doubling and shared focus sessions as a top wanted feature. *(C: [Shimmer](https://www.shimmer.care/blog/how-to-choose-best-body-doubling-for-you), [ADHD tools roundup](https://add.org/adhd-tools-for-adults/))*
- **Next (L):** a squad "focus room" where friends start a timer together and see who's in session (needs real-time, so a small server addition).

---

## 2. Time & tasks (the "new way to do it vs. a calendar" part)

### 8. Tasks and time blocks in one view ✅ 🟡
- **What people say:** "A task without a time slot doesn't feel real until it's overdue", so users want tasks and time on the same screen. *(C: [ADHD calendar app roundup](https://www.toolfinder.com/best/calendar-apps-for-adhd))*
- **Today:** the Plan tab's timeline with time blocks, overlap warnings, free gaps, a now line, and an "up next" countdown.
- **Next (M):** drag to reschedule; **import your existing calendar (.ics)** as fixed blocks; "fit my day" auto-suggestion.

### 9. Help with time blindness ✅ 🟡
- **What people say:** A single reminder fails because it's dismissed with "I have plenty of time"; people want escalating alerts and countdowns that make time visible. *(C: [ADHD planner roundups](https://affine.pro/blog/best-adhd-planner-apps))*
- **Today:** countdown strip on Today, heads-up reminders before blocks.
- **Next (S):** a "time left today" bar and optional escalation (heads-up → start → "10 min past start").

### 10. Reminders that don't nag but do arrive ✅ 🟡
- **What people say:** Excess notifications drive opt-outs and uninstalls; **timing and context** decide whether a reminder feels helpful. Habit apps get blamed for either spamming or going silent. *(A: [Springer, context-aware notifications](https://link.springer.com/article/10.1007/s42486-023-00143-8); C: [push fatigue guide](https://contextsdk.com/blogposts/avoiding-push-fatigue-common-user-turn-offs))*
- **Today:** opt-in, daily cap, quiet hours, shame-free wording; fires while the app is open or recently active.
- **Next (L):** **real push when the app is fully closed** (Web Push over your HTTPS link). I can build it, but I can't confirm delivery without your phone in hand.
- **Next (S):** snooze, "don't remind me about this one."

### 11. Recurring tasks I set up once ✅
- **What people say:** Recurrence removes the burden of re-deciding and re-remembering. *(C: ADHD planner roundups)*
- **Today:** daily / weekdays / weekly repeats.

### 12. Overdue without the red wall of shame ✅ 🟡
- **What people say:** Traditional planners punish missed tasks with shame-inducing notifications. *(C: ADHD roundups)*
- **Today:** one-tap "fresh start: move overdue to today."
- **Next (S):** a Sunday triage: keep / reschedule / drop each stale task.

### 13. Help me start ("tiny first step") ❌
- **What people say:** Task initiation is the hard part; tools that break a task into a tiny first action are popular. *(C: [Tiimo on task initiation](https://www.tiimoapp.com/blog/task-initiation-tactics))*
- **Next (S/M):** a "first step" field and a 2-minute starter button that launches a 5-minute focus session; optional AI breakdown if you connect a model.

### 14. Realistic time estimates ❌
- **What people say:** Time-blocking users blame the tool, but the core issue is plans that don't survive contact with the day; AI auto-schedulers that keep reshuffling are often seen as overkill. *(C: [Sunsama/Akiflow comparison](https://thebusinessdive.com/akiflow-vs-sunsama), [time-blocking guide](https://www.lilachbullock.com/which-time-blocking-app-should-you-use/))*
- **Next (M):** log estimated vs. actual and show your personal multiplier ("you usually take 1.4× longer"). *(My suggestion from the planning-fallacy literature, not a direct user quote.)*

---

## 3. Money

### 15. Import transactions without handing over bank passwords ✅ 🟡
- **What people say:** After Mint shut down, users wanted automatic categorization but many won't hand bank credentials to an aggregator; bank connections that break often and pricey tiers are common gripes. *(B: [Mint-shutdown forum thread](https://www.savingadvice.com/forums/forum/financial-chit-chat/general-discussion/743487-since-mint-is-shutting-down-how-does-everyone-here-budget); C: [budgeting app roundup](https://unstar.app/blog/ynab-vs-rocket-money-vs-monarch-budgeting-apps-ranked-2026))*
- **Today:** bank **CSV import**, de-duplication, sign auto-detect, editable auto-category rules.
- **Next:** live bank sync via a third-party bridge (L). Self-hosted apps like Actual Budget support bridge services, but I haven't verified current options or pricing, so check before I build.

### 16. True envelope / zero-based budgeting 🟡
- **What people say:** **"Zero-based budgeting" is the #1 request on Lunch Money's board with 332 votes**, and users pick Actual Budget as a free "give every dollar a job" tool. *(B: [Lunch Money feedback board](https://feedback.lunchmoney.app); C: [Actual Budget overview](https://store.elfhosted.com/product/actual/))*
- **Today:** monthly envelopes with a daily "safe to spend."
- **Next (M):** a "to be budgeted" line (income − assigned), rollover of unspent envelopes, move-money-between-envelopes.

### 17. Works with irregular income ❌
- **What people say:** Apps that compare spending to a fixed monthly income show a red deficit after any slow week; freelancers want a "safe to spend" that accounts for taxes and unpaid invoices. *(C: [PocketGuard/SteadyFlow examples](https://betalist.com/startups/steadyflow))*
- **Next (M):** a baseline-income mode, a tax-reserve percentage, and a smoothed allowance.

### 18. Split a purchase across categories ❌
- **What people say:** A long-standing request: one grocery receipt covering food and household. *(B: [CalendarBudget forum](https://calendarbudget.com/forums/reply/re-missing-features-split-transactions-sub-categories-5), Lunch Money roadmap)*
- **Next (S/M):** split a transaction into parts.

### 19. Catch subscriptions and sneaky fees ❌
- **What people say:** Long-time Mint users valued passively spotting rogue charges and comparing categories year over year. *(B: Mint forum thread above)*
- **Next (M):** detect recurring charges in imported history and offer "add as a bill"; flag price increases; month-over-month and year-over-year category comparison.

### 20. See my net worth over time ❌
- **What people say:** Net-worth history was a prized Mint feature people missed. *(B: Mint forum thread)*
- **Next (M):** manual accounts (cash, savings, debts) with a trend line.

### 21. Keep my finances private on a shared phone ❌
- **What people say:** Privacy concerns are a top reason people stop tracking (45% of location trackers quit over it) and why people choose local-first, self-hosted budgeting tools. *(A: Epstein et al.; C: Actual Budget overview)*
- **Today:** self-hosted, access token, nothing on the squad board.
- **Next (S/M):** an app-lock PIN, with a "hide amounts" toggle for screenshots.

---

## 4. Ideas I'm adding that research didn't directly confirm

- **22. Weekly review ritual (M).** One screen: habits, money, tasks, mood, "what to change next week," tied to the fresh-start effect. *(Standard practice; no direct user quote found.)*
- **23. Household/partner mode (L).** Shared budget and tasks with one other person. *(Common in the category; not evidenced in my research, so tell me if it matters to you.)*

---

## Sources

**Studies (A)**
- Epstein et al., *Beyond Abandonment to Next Steps*. [PMC5428074](https://pmc.ncbi.nlm.nih.gov/articles/PMC5428074/)
- Epstein et al., *A Lived Informatics Model of Personal Informatics*. [Self-research library](https://library.selfresearch.org/research/a-lived-informatics-model-of-personal-informatics/)
- UCL / Loughborough fitness-app shame study. [Earth.com](https://www.earth.com/news/why-fitness-apps-might-be-harming-your-health/) · [Newsweek](https://newsweek.com/fitness-apps-study-says-they-can-do-more-harm-than-good-10913928)
- Tsay et al., student engagement and the novelty effect. [Greenwich](https://gala.gre.ac.uk/id/eprint/19946/)
- Context-aware notifications. [Springer](https://link.springer.com/article/10.1007/s42486-023-00143-8)

**Public forums and vote boards (B)**
- Mint-shutdown thread. [SavingAdvice](https://www.savingadvice.com/forums/forum/financial-chit-chat/general-discussion/743487-since-mint-is-shutting-down-how-does-everyone-here-budget)
- Lunch Money feedback board. [feedback.lunchmoney.app](https://feedback.lunchmoney.app)
- CalendarBudget feature forum. [Split transactions](https://calendarbudget.com/forums/reply/re-missing-features-split-transactions-sub-categories-5)

**Roundups and review summaries (C, secondary)**
- [Habit app rankings](https://unstar.app/blog/streaks-habitica-way-of-life-strides-habit-tracking-apps-ranked-2026) · [Streak anxiety](https://habitdoom.com/blog/streak-anxiety-habit-trackers) · [Habitica reviews](https://kimola.com/reports/transform-your-productivity-with-habitica-insights-app-store-us-156491)
- [Budgeting app rankings](https://unstar.app/blog/ynab-vs-rocket-money-vs-monarch-budgeting-apps-ranked-2026) · [Actual Budget](https://store.elfhosted.com/product/actual/) · [SteadyFlow](https://betalist.com/startups/steadyflow)
- [ADHD calendar apps](https://www.toolfinder.com/best/calendar-apps-for-adhd) · [ADHD planners](https://affine.pro/blog/best-adhd-planner-apps) · [Tiimo](https://www.tiimoapp.com/blog/task-initiation-tactics) · [Body doubling](https://www.shimmer.care/blog/how-to-choose-best-body-doubling-for-you)
- [Time-blocking apps](https://thebusinessdive.com/akiflow-vs-sunsama) · [Push fatigue](https://contextsdk.com/blogposts/avoiding-push-fatigue-common-user-turn-offs)
