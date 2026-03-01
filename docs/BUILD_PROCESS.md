# BUILD_PROCESS.md
## Decision Companion System — Build Journal
*This document reflects the honest, real process of building this system — including confusion, mistakes, and corrections. Every decision is explained. Nothing is polished after the fact.*

---

## How I Started

**Day 1 — February 14, 2026 (1 hour)**

Received the assignment email from Vonnue at 5:30 PM. First reaction was confusion — this was nothing like a typical coding task. No specific algorithm, no clear "right answer." The line *"We want to see how you build"* told me documentation was as important as code.

**5:30 PM — My first move was to paste the entire Vonnue email into Claude and ask it to elaborate the problem statement.** I needed someone to break it down before writing a single line of code.

Key realizations from that session:
- The system had to be **generic** — not hard-coded for laptops or any one scenario
- The **core decision logic must be mine** — AI cannot make the decision
- Documentation was as important as the code itself

**5:55 PM — I had several real doubts. I asked Claude directly:**

> *"Not AI Dependent — suppose I have an API key and I send user input + weight and it returns the answer — we are not supposed to do that, right?"*

Claude confirmed: AI is allowed for formatting and explanation. It is NOT allowed for the core decision. That boundary became a design principle I committed to from Day 1.

Other doubts I clarified that day:
- "Not hard-coded" means the user must have flexibility to add, change, and delete options ✅
- CLI vs Website vs Mobile App — I chose **website** because it is more professional and easier for Vonnue to evaluate
- I rejected: React (too much learning curve), Mobile App (overkill), TOPSIS/AHP algorithms (too complex to explain)

---

## Initial Ideas — February 15, 2026 (2 hours)

**6:30 PM — I shared my rough 3-phase vision before writing any code:**

**Phase 1 (Manual Input):** User enters products + features manually → system calculates decision using weighted scoring

**Phase 2 (Web Scraping):** System auto-fetches product specs from internet → user only enters product name

**Phase 3 (Review Analysis):** System analyses real customer reviews from multiple sources to assist or override the scoring

This phased roadmap was my own idea. I committed to Phase 1 fully before thinking about Phase 2 or 3.

**Technology decision and why:**

| Option | Decision | Reason |
|--------|----------|--------|
| React | Rejected | Too much learning curve for this timeline |
| Python Flask | Rejected | Chose Node.js for Phase 2 compatibility |
| Mobile App | Rejected | Overkill for this assignment |
| Node.js + Express | Chosen | Prepares for Phase 2 web scraping, single-language stack |
| Plain HTML/CSS/JS | Chosen | No framework overhead, sufficient for requirements |

**Why Node.js specifically:** Phase 2 requires web scraping. Node.js has Cheerio and Puppeteer for that. Choosing it now means no language switch later.

---

## First Algorithm — February 16, 2026

**My own algorithm idea before any AI input:**

Calculate absolute distance from ideal values for each feature. Sum them. Product with smallest total distance wins. I then asked Claude only to validate and give edge cases — not to write code.

Claude confirmed: this is a real technique called the "distance from ideal point method." That validation mattered because I needed to know my thinking was sound before going further.

**Problems Claude identified in my first version (code review):**
1. No weights — all features treated equally
2. No "higher vs lower is better" distinction
3. No normalization — price in thousands dominates RAM in single digits
4. Values stored as strings, not numbers

These were not AI-generated solutions. Claude pointed out the problems; I implemented the fixes myself.

---

## Improving the Algorithm — February 16, 2026 (3 hours)

**10:00 AM — Implemented normalization**

Problem: Price = ₹30,000 and RAM = 16 are on completely different scales. Without normalization, price differences always dominate.

Fix — min-max normalization to 0–100 scale:
```
normalized = (value - min) / (max - min) × 100
```

**Bug I made here:** I normalized product values but forgot to normalize the ideal values using the same formula. I was comparing 0–100 scale values against raw ideal numbers — completely wrong results. Took 45 minutes to find and fix.

**Why I chose min-max normalization over asking users to rate 1–10:**
Claude offered the simpler option. I rejected it because it loses real data. A user entering "₹45,000" is more informative than rating price "7/10." I wanted to preserve actual values.

**10:55 AM — My feedback on edge cases:**
Most edge cases had simple UI fixes (validation before submission). The real algorithmic challenge was direction logic.

---

## Adding Direction Logic — February 16, 2026 (Afternoon)

The "higher vs lower is better" problem was the most important fix in Phase 1.

Without it: A laptop priced at ₹45,000 when the ideal is ₹50,000 would be penalized. But it's cheaper — that should be rewarded.

**The logic I implemented:**
- **Higher is better** (RAM, Battery, Performance): `penalty = max(0, ideal − actual)` — no penalty if actual exceeds ideal
- **Lower is better** (Price, Weight): `penalty = max(0, actual − ideal)` — no penalty if actual is below ideal

**Bug found during implementation (my mistake):**

I wrote: `d[i][y] = abs(d[i][y] - norm_req_list[x]) + penalty`

This doubled the penalty. `abs()` already gave the distance, then I added penalty on top. All scores were 2× too high.

Fix: Remove `abs()`, store penalty directly: `d[i][y] = penalty`

Claude caught this in code review. This mistake is documented honestly because it shows real development process.

---

## Tie Detection — February 16, 2026 (Evening)

Added tie detection with float tolerance.

Initial approach: `if score == mvp_score`

Problem: Floating point comparison with `==` fails due to precision errors (e.g., 15.3 stored as 15.2999999...).

Fix chosen: `if abs(score - mvp_score) < 0.001`

I chose this over other options (secondary tiebreaker, letting user decide) because it is the simplest and most transparent.

---

## Website Setup — February 16, 2026 (Evening)

**Decision: Convert Python → JavaScript**

Rather than run a Python Flask backend, I converted the algorithm to JavaScript so the whole project uses one language (Node.js).

**6:45 PM — I gave Claude the green flag to build the website.** Claude responded with step-by-step instructions. The response was very long — I used ChatGPT to summarize it before implementing. Using the right tool for the right task.

**Multi-step form design (my UX decision):**
- Step 1: Enter number of products and features
- Step 2: Define criteria (name, importance, direction)
- Step 3: Enter product values
- Step 4: Enter ideal values
- Step 5: View results with ranking and breakdown

**7:45 PM — Git confusion:** I didn't understand what `git commit` actually does. I thought it would upload files to GitHub. Claude clarified that git is local — nothing leaves my machine unless I explicitly push. This removed my fear of committing.

---

## Testing — February 17, 2026 (2 hours, 1:00 AM)

Ran 10 manual test cases through the web interface:

| Test | Scenario | Result |
|------|----------|--------|
| 1 | Laptops (balanced priorities) | ✅ Correct |
| 2 | Laptops (budget priority) | ✅ Correct |
| 3 | Laptops (performance priority) | ✅ Correct — opposite winner to Test 1, proving weights work |
| 4 | Job candidates | ✅ Correct |
| 5 | Travel destinations | ✅ Correct |
| 6 | Identical products | ✅ Tie detected correctly |
| 7 | Extreme weight (10:1) | ✅ Correct |
| 8 | Ideal above all products | ✅ Correct — system picks closest |
| 9 | Investment strategy | ✅ Correct (I predicted wrong — system was right) |
| 10 | Tech stack selection | ✅ Correct |

**Test 9 was the most educational.** I predicted Gold would win. The system chose Stocks. I was about to report a bug. Then I manually recalculated: Stocks had penalty on only 1 criterion, Gold had penalties on 2. The system was correct. My intuition was wrong. Lesson: always verify before concluding the system is broken.

---

## New Feature: AI Explanation System — February 17, 2026 (Evening)

**6:00 PM — My idea:** The results showed "penalty: 12.50, weighted: 6.25 pts" — technically correct but meaningless to a real user.

I wanted natural language: *"Laptop A won because it had the best price at ₹45,000 while maintaining strong RAM."*

**First I verified with Claude whether this violates Vonnue's conditions.** The answer: no. AI for explanation is acceptable as long as the core scoring is deterministic. I only proceeded after this confirmation.

**6:10 PM — Green flag given. Claude built the backend changes:**
- `.env` file for API keys
- Groq API (Llama 3.3-70B) as primary explanation source
- Gemini API as backup
- Template fallback that always works offline

**6:40 PM — I passed Claude's response to Codex (VS Code integrated AI) instead of manually editing files.** Codex is better at inserting code into existing files precisely. Using it here was a deliberate tool choice.

**6:50 PM — Bug:** Groq returned 403 error. Rather than debugging from scratch, I shared the working `server.js` from my other project (Antigravity) which had the correct API URLs. This helped Claude identify the issue immediately — the URL was `api.x.ai` (xAI's Grok) instead of `api.groq.com` (Groq/Llama). A naming confusion.

**7:10 PM — New feature working.**

---

## Improving Explanation Styles — February 18, 2026 (2 hours)

**9:10 PM — New idea:** One explanation style does not fit all users. A data-driven person wants numbers. A storytelling person wants narrative.

I proposed 4 styles:
1. 📊 Data-Driven — metrics and numbers
2. 📖 Storytelling — narrative
3. ⚖️ Comparative — side-by-side
4. ⚡ Actionable — what to do next

Claude approved and asked clarifications. I answered, asked for a minimal/compact response, then passed it to Codex to implement.

**9:45 PM — After testing:** explanations were too generic. I passed Claude's original detailed response (not the minimal one) to Codex to personalize the styles.

**9:55 PM — Improved.** Explanations were now readable and distinct per style.

**Key UX decision I made:** 4 styles cycle on a single Refresh button instead of showing all 4 simultaneously. Showing all 4 at once would overwhelm the user. One at a time, user-controlled, is cleaner.

---

## Phase 1.5: Hybrid Input Engine — February 18–21, 2026

**This was the biggest architectural addition after Phase 1.**

**Origin (18th Feb, 10:00 PM):** While working on the Antigravity project, a discussion about qualitative criteria sparked an insight. The core problem: what if a user cannot give a number for "customer service quality" or "food taste"?

**The 3-input-type solution I designed:**
- **Type 1 (Numeric):** Standard number — unchanged from Phase 1
- **Type 2 (Scale):** Dropdown — Excellent (10), Very Good (9), Good (8), Above Average (7), Average (6), Below Average (5), Poor (4) — maps to numbers automatically, no AI needed
- **Type 3 (Review):** Free text — user writes a description, AI converts it to a 1–10 score

**Why Scale before Review:**
Scale covers most subjective criteria without AI. It is deterministic, transparent, and always works offline. I only reach for AI (Type 3) when the user has a complex qualitative opinion that cannot be captured in 7 levels.

**Why AI for Review is justified:**
AI here is a *translator*, not a *decision maker*. It converts "The food was amazing but service was slow" into a score of 6/10. That score then enters the same deterministic algorithm as everything else. AI touches the input conversion only — never the decision.

**6 design concerns I raised before implementation (21st Feb, 10:05 AM):**
1. What if AI fails? → Manual override dropdown in approval stage
2. What if AI gives inconsistent scores? → Confidence field in response
3. How does the user verify AI scores? → Step 4.5 Approval Stage added
4. What happens to the core algorithm? → Unchanged. Preprocessor converts everything to numbers first
5. Rate limiting on free APIs? → Staggered requests with delay
6. How to show where each score came from? → Source badges (Numeric / Scale / AI: Gemini / AI: Groq)

**The Approval Stage (Step 4.5) — my most important UX decision of Phase 1.5:**

Instead of silently using AI scores, I show the user a review table: their original text, the AI's score, confidence level, and source. They can override any score using the scale dropdown before final calculation. This keeps the user in control. AI assists, human approves.

---

## Bugs Encountered During Phase 1.5 — February 21, 2026

**Error 429 — Gemini rate limiting (11:00 AM):**

Gemini free tier allows 5 requests per minute. The preprocessor fires one request per product — with 3 products, all 3 go simultaneously = 429 immediately.

Two solutions considered:
1. Add 13-second delay between requests (safe under 5 RPM limit)
2. Switch primary API to Groq (faster, higher rate limit on free tier)

Chose option 2 for score extraction — Groq first, Gemini fallback. Groq handles the load better and response is faster for short JSON outputs.

**Explanation text showed penalty math instead of real values:**

The 4 explanation styles said things like *"penalty: 12.50, weighted: 6.25 pts"* — meaningless to users. The explanation functions only had access to normalized/calculated values, not what the user actually entered.

Fix: Pass `products_data` (original user-entered values) into the explanation functions so they can say *"Price: ₹45,000 ✓"* instead of penalty scores.

---

## Git Workflow — February 22, 2026

Until today I had only one commit. Today I learned proper git workflow and built a real commit history.

**What I learned about git:**
- `git commit` is local — nothing goes to GitHub until `git push`
- Commit messages should describe what changed, not just "update"
- The `COMMIT_EDITMSG` file that opened in VS Code — that is Git's commit message editor. Type on line 1, save and close
- LF/CRLF line ending warnings on Windows are harmless

**Commits made today:**
1. `Phase 1 complete: Core decision algorithm with weighted penalty scoring` — 9 files, 1339 insertions
2. `Phase 1.5: Hybrid input engine with scale and AI review scoring` — 5 files
3. `Config: Add .gitignore to exclude env and temp files`

**What .gitignore protects:**
- `node_modules/` — thousands of dependency files, not our code
- `backend/.env` — contains API keys, must never be committed to a public repo
- `*.docx` — private research notes

---

## Alternative Approaches Considered and Rejected

| Approach | Reason Rejected |
|----------|-----------------|
| React framework | Learning curve too steep for this timeline |
| TOPSIS / AHP algorithms | Too complex to explain; weighted penalty is sufficient and more explainable |
| AI makes the decision | Violates Vonnue's "not AI dependent" requirement |
| Hard-coded scenarios | Violates Vonnue's "not hard-coded" requirement |
| Python Flask backend | Chose Node.js for single-language stack and Phase 2 compatibility |
| Ask users to rate everything 1–10 | Loses real data; ₹45,000 is more informative than "7/10" |
| Show all 4 explanation styles at once | Overwhelming; cycling one at a time is cleaner UX |
| Silent AI scoring | User must verify AI scores — Approval Stage added for transparency |
| Mobile App | Overkill, weeks to build properly |

---

## What Changed During Development

| Original Plan | Final Implementation | Reason |
|---------------|----------------------|--------|
| CLI tool | Web interface | More professional, easier to evaluate |
| Simple absolute distance | Direction-aware penalty scoring | Handles "higher vs lower is better" correctly |
| Winner only | Ranking + detailed breakdown | More explainable, meets assignment requirement |
| Manual weight percentages | Importance rating 1–5, auto-normalized | More intuitive for non-technical users |
| Exact float equality for ties | Epsilon tolerance < 0.001 | Floating point precision issues |
| Only numeric inputs | Numeric + Scale + AI Review | Real decisions involve qualitative criteria |
| Single explanation | 4 cycling explanation styles | Different users need different formats |
| Immediate AI scoring | Step 4.5 Approval Stage | User must verify AI interpretations |

---

## Honest Mistakes and Corrections

| Mistake | Impact | How Found | Fix |
|---------|--------|-----------|-----|
| Did not normalize ideal values | Completely wrong results | Claude code review | Added normalization using same min/max formula |
| Double penalty (`abs() + penalty`) | All scores 2× too high | Claude code review | Removed abs(), store penalty directly |
| Assumed Test Case 9 failed | None — system was correct | Manual recalculation | Learned to verify before concluding system is wrong |
| Thought git commits upload to GitHub | Delayed first commit | Asked Claude | Understood git is local |
| Wrong API URL (api.x.ai vs api.groq.com) | 403 errors on all Groq calls | Shared working project file | Corrected URL and model name |
| 3 simultaneous Gemini requests | 429 rate limit on every run | Console logs | Switched to Groq-first, added stagger delay |

---

## AI Tool Usage Transparency

**Tools used:**
- **Claude (Anthropic):** Algorithm review, bug identification, architecture design, documentation
- **ChatGPT:** Summarizing long Claude responses before implementation
- **Codex (VS Code):** Implementing Claude's described changes into actual files

**What AI contributed:**
- Validation that my distance-from-ideal algorithm is a real technique
- Bug identification in code reviews (I fixed them)
- Phase 1.5 architecture after I described the problem
- Explanation text templates

**What I contributed:**
- The distance-from-ideal algorithm concept (my own idea)
- The 3-phase project roadmap
- All technology stack decisions
- The 4-style explanation concept
- The Approval Stage UX design
- All test case design and execution
- All bug fixes after diagnosis

---

## Current State

**Phase 1 — Complete ✅** Generic decision system, direction-aware penalty scoring, normalization, weighted ranking, tie detection, 5-step web wizard, AI explanations with 4 styles and offline fallback.

**Phase 1.5 — Complete ✅** 3 input types, preprocessing pipeline, Approval Stage, source badges, confidence indicators, AI failure handling with manual override.

**Phase 2 — Planned** Web scraping for automatic product data fetching.

**Phase 3 — Planned** Customer review analysis.

---

## Phase 2 Pre-work: Decision Visualizer — February 24–25, 2026

### Why This Feature Exists

After Phase 1.5 was complete, I had a working decision system but a transparency problem. The results page showed a ranking and a penalty score — correct, but not convincing. A user might ask: *why did Alice win? How did the weights actually affect the outcome?* The answer was buried in a breakdown table that most users would skip.

The Visualizer was my answer to that. The goal: make the algorithm visible step by step, so the user watches the weights and penalties determine the winner rather than just reading the conclusion.

This directly addresses Vonnue's evaluation criteria — *"clarity of thinking"* and *"transparency."* The animation is not decoration. It is the algorithm made watchable.

---

### Technology Decision: Pixi.js

**First instinct was GSAP + CSS.** Both are capable of animation and I already had some familiarity. Claude agreed they could work for basic movement.

**But I wanted WebGL-quality glow effects** — the kind that make something look like a fireball rather than a colored circle. CSS `box-shadow` is flat. GSAP animates CSS properties. Neither can do real-time bloom, additive blending, or particle effects without WebGL.

**Pixi.js chosen because:**
- WebGL renderer — real glow via `BlurFilter`, layered concentric rendering
- `AnimatedSprite` — plays PNG frame sequences natively, exactly what fireball spritesheets need
- `app.ticker` — frame-perfect animation loop, same as a game engine
- One CDN import, no build step

**Honest assessment:** For the current prototype, GSAP could have matched most of what we built. Pixi earns its place specifically for the fireball glow and the future particle system. The choice was forward-looking, not immediately necessary.

---

### Sprite Sourcing

**Character sprites — Sutemo Male Sprite Pack (itch.io)**

Three candidates needed distinct visual identities. I searched itch.io for visual novel style bust-up sprites — head and torso, transparent background, multiple expressions.

Sutemo's pack had:
- 10 expressions per character (laugh, smile, smirk, normal, surprised, sad, angry)
- 5 hair colors — used brown, black, light brown for the 3 candidates
- PSD format with separate layers per expression

**Export workflow:** Opened PSD in Photopea (free browser Photoshop). Toggle one expression layer visible at a time, hide the Paper (white background) layer, export PNG with `Ctrl+Shift+Alt+S`. Repeated for 3 characters × 9 expressions = 27 PNGs.

Naming convention: `char_normal.png`, `char2_smile1.png`, etc.

**Narrator sprite — Finch Tired Teacher (itch.io, by Eufasy)**

The narrator needed to look like an analyst, not a player. A lab-coat scientist character fit the "Decision Companion" theme. 6 expressions used: neutral, explaining, impressed, concerned, proud, surprised.

License: School/personal projects allowed. Credit: Eufasy.

---

### Fireball Asset Research

The original design used Pixi `Graphics` circles with concentric rings for the penalty orb — simulating glow by drawing overlapping semi-transparent circles. The result looked like a plain circle, not a fireball.

**What a real fireball requires:** white-hot core, color gradient outward (white → yellow → orange → red), organic irregular flame shape, animated. This cannot be drawn programmatically at acceptable quality without a spritesheet made by an artist.

**Research path:**
1. Reviewed a Godot 4 particle fireball tutorial — too complex, game-engine-specific
2. Checked a Unity paid asset ($29) — confirmed the spec I needed (256×256 frames, transparent PNG)
3. Found `weisinx7` fireball pack on itch.io — free for personal use, 5 types, 30–40 frames each

**The 5 types and how they map to penalties:**

| Type | Penalty Range | Visual Character |
|------|--------------|-----------------|
| `fire_ball_side_small` | 1–20 | Small, calm flame |
| `fire_ball_side_medium` | 21–45 | Medium intensity |
| `fireball_high_speed_side_small` | 46–70 | Fast, aggressive |
| `meteor_side_medium` | 71–88 | Heavy, devastating |
| `fire_ball_blue_side_small` | 89–100 | Maximum penalty, blue energy |

All frames are side-facing. Since fireballs fall downward in the visualizer, I applied `rotation = Math.PI / 2` in Pixi to turn side-facing frames into downward-falling ones. The flame trail then points upward as the ball descends — physically correct.

---

### Iterative Design Decisions

**Orb → Fireball**

The first implementation used simple `PIXI.Graphics` orbs — concentric circles at decreasing alpha to simulate glow. After seeing them in the browser they looked like plain circles. Switched to spritesheet `AnimatedSprite` approach once the weisinx7 asset was confirmed suitable.

**Left-Right Layout for Penalty and Values**

Early versions placed penalty scores below the platform. This caused three-way overlap: running total, per-criterion penalty, and the values box all competed for the same narrow space.

Resolution after ASCII drawing iterations:
- Penalty value (`-20.3`) → **left of character**, right-aligned text anchor
- Values box (S/E/C raw data) → **right of character**, bordered box
- Running total (`⚠ 7.2`) → **below platform**, always visible

Both left and right elements are Y-anchored to platform position and update in real time as the platform sinks.

**Auto-Follow Camera**

With 3 criteria the bottom element (`⚠ 50.0`) was already partially cut off. With 5–6 criteria it would disappear entirely.

Solution: all game objects (platforms, characters, fireballs, math boxes) live inside a `gameWorld` Pixi container. Background stars live directly on `app.stage` and stay fixed. When platforms sink, `recalcCameraTarget()` calculates the lowest visible element and smoothly shifts `gameWorld.y` upward. The camera follows in real time during sink animations.

Manual scroll buttons (↑ ↓ ⌂) added as HTML overlay on right edge of canvas for cases where user wants to look around freely. ⌂ snaps back to origin.

**Math Equations in Boxes**

Early floating text (drifting upward, fading) was hard to read — text moved while users were trying to read it. Replaced with static bordered boxes, one per candidate, appearing sequentially and staying until the next criterion begins. This gives users time to understand the calculation before the fireball fires.

---

### CHANGES.md Approach with Codex

The visualizer accumulated many iterative changes over the session. Writing and applying changes directly in Claude would have consumed tokens rapidly on a 700+ line file.

**Solution:** I wrote precise `CHANGES.md` specification files describing exactly what to add, remove, or replace — including pseudocode and positioning specs. Codex (which reads the actual file on disk) applied them. Claude reviewed the results and wrote the next spec.

Files written this session:
- `CHANGES.md` — initial Idea 2 laser system
- `CHANGES_fireball.md` — fireball spritesheet system
- `CHANGES_fixes.md` — layout and UX fixes round 1
- `CHANGES_fixes2.md` — math boxes, penalty labels, static no-penalty text
- `CHANGES_fixes3.md` — penalty-left values-right layout, blue ball size, ideal badge
- `CHANGES_layout.md` — final layout with ASCII-confirmed positioning
- `CHANGES_final.md` — auto-follow camera, scroll controls, normalization boxes, winner reveal button

This workflow — Claude designs, Codex implements, Claude reviews — proved more efficient than direct file editing for large iterative changes.

---

### Mistakes Made During Visualizer Development

| Mistake | Impact | Fix |
|---------|--------|-----|
| Used `app.ticker.add()` return value to remove callback | Stale tickers never removed, platforms stayed down after Watch Again | Store callback reference in named variable, pass to `app.ticker.remove()` |
| All 3 orbs dropped simultaneously | User attention split, couldn't follow individual candidate evaluation | Sequential per-candidate loop with `await` between each |
| Math text floated above character, not above column center | Overlap with character name labels | Fixed x position to `CENTERS[i]`, anchor `(0.5, 0)` |
| Ideal text rendered in Pixi canvas | Overlapped with narrator HTML bar | Moved raw ideal to HTML `div#ideal-badge`, normalized ideal to second line of same badge |
| Side-facing fireball sprites used without rotation | Flame trail pointed sideways during downward fall | Applied `rotation = Math.PI / 2` to all `AnimatedSprite` instances |
| Values box used abbreviated S/E/C labels | Unclear to user what S/E/C meant | Changed to full feature names from `DEMO.features` array |
| Winner overlay appeared automatically | User had no time to see final state before overlay covered it | Added `waitingForWinnerReveal` flag, "Reveal Winner 🏆" button |

---

### Current State (Updated)

**Phase 1 — Complete ✅** Generic decision system, direction-aware penalty scoring, normalization, weighted ranking, tie detection, 5-step web wizard, AI explanations with 4 styles and offline fallback.

**Phase 1.5 — Complete ✅** 3 input types, preprocessing pipeline, Approval Stage, source badges, confidence indicators, AI failure handling with manual override.

**Visualizer Prototype — Complete ✅** Step-by-step animated decision explanation. Pixi.js WebGL renderer. Fireball spritesheets with 5 penalty tiers. Analyst narrator with expression changes. Auto-follow camera. Math equation boxes. Sequential per-candidate evaluation. Hardcoded demo data (Alice/Bob/Charlie). Pending: integration with real `/api/calculate` response data.

**Phase 2 — In Progress ⚙️** Reliance Digital search + product scraper working. Smart Compare UI built. Visualizer integration with real API data in progress.

**Phase 3 — Planned** Customer review analysis.

---

## Visualizer Integration — February 25, 2026

### Connecting the Visualizer to Real Data

Before Phase 2 could begin, one outstanding item from Day 9 needed to close: the visualizer was still running hardcoded demo data (Alice, Bob, Charlie). Real `/api/calculate` results had to flow into it.

**The approach:** After a successful calculation, `script.js` writes the full result payload to `localStorage` under a key `VISUALIZER_DATA`, then opens the visualizer in a new tab with a cache-busted URL. The visualizer reads `localStorage` on boot and replaces the DEMO object if valid data is present.

**Why localStorage and not sessionStorage:** The first implementation used `sessionStorage`. This was wrong. `sessionStorage` is tab-scoped — a new tab opened by `window.open()` gets its own empty session storage. The visualizer opened in a new tab and never saw the data stored by the parent tab. Antigravity's Sonnet diagnosed this and switched both sides to `localStorage`.

**The stale runtime bug:** Even after the storage fix, the visualizer kept logging `[Visualizer] Using fallback DEMO data`. The root cause: the browser was serving a cached copy of the old `script.js` that had no payload-writing logic. Fix — versioned script include (`script.js?v=runtime-source-fix-2026-02-25-1`) and a timestamp parameter in the iframe URL (`?build=...&ts=...`). Once the browser was forced to load the new file, the console confirmed: `[Visualizer] Using injected data for: Bijo, Cijo, Aaron`.

**The null winner bug:** A second silent failure — when all candidates tied, `result.winner` is `null`. The validator checked `d.winner` as a truthy value, so `null` failed validation and fell back to demo. Fix: changed the check from `d.winner` (truthy) to `'winner' in d` (structural), which correctly passes for `null`.

**Normed values timing bug:** `decisionLogic.js` overwrites the normalized values array `d[i][y]` with the penalty score inside the scoring loop. If you tried to capture normed values after the loop, you got penalty numbers. Fix: snapshot `normedValues` into a separate object before the penalty loop runs, not after. This was a subtle timing issue that would have been hard to find without understanding the algorithm deeply.

After all three bugs were fixed, the visualizer played the full animation using real user input data.

**5+ candidate support added:** The original visualizer hardcoded 3 characters. I had already created char4 and char5 sprite folders (10 expressions each, Sutemo pack) and wanted the system to support any number of candidates. Fix: made N dynamic, added cyclic character assignment (candidate 6 reuses char1, candidate 7 reuses char2, and so on), added horizontal world with camera pan for overflow candidates beyond 4.

---

## Phase 2: Web Scraping — February 25–28, 2026

### Why Phase 2 Exists

Phase 1 required the user to enter every product value manually — price, RAM, battery, rating — number by number. That is fine as a prototype but impractical for a real decision. Phase 2's philosophy: *the more real data the system can fetch automatically, the better the experience.* The user should only need to type a product name.

---

### Tool Context: Antigravity IDE

From Day 7 onwards, I was using three AI tools in parallel:

- **Claude (claude.ai):** Architecture, planning, algorithm design, documentation
- **Codex (VS Code integrated):** Implementing Claude's CHANGES.md specs into actual files
- **Antigravity IDE:** A desktop AI IDE (local app, 165MB) giving access to Gemini and Claude models directly within the editor — used when Codex hit its usage limit or when the task required understanding actual files on disk

When Codex ran out mid-session (Day 10), I downloaded and updated Antigravity, selected **Gemini 3 Flash** in Fast mode for quick surgical edits, and **Claude Sonnet 4.6 (Thinking) in Planning mode** for deeper architectural tasks. The distinction mattered: Fast mode for simple file edits, Planning mode for multi-file changes where the agent needed to reason about the whole codebase before touching anything.

The CHANGES.md workflow I developed for the Visualizer carried directly into Phase 2:
1. Claude (this chat) designs the change and writes a precise CHANGES.md spec
2. Antigravity reads the actual project files on disk and applies the spec
3. Antigravity responds with a summary of exactly what it changed and where
4. Claude reviews and writes the next spec

This kept token usage low in the planning chat and let the IDE handle the file-level execution where it was better equipped.

---

### Architecture Decisions

**First move — education before code.** I had no web scraping experience going into Phase 2. Before writing a line, I asked Claude to explain the basics: what scraping is, how production companies do it, what APIs like SerpAPI provide versus what raw scraping provides, and where the boundaries are. That foundation shaped every decision that followed.

**My original design — user pastes URLs directly.** I rejected this quickly. It puts all the research burden on the user, who has to find products themselves before the system helps them decide. The better flow: user types a name, system finds options, user picks which to compare. No URLs involved.

**Keyword refinement idea (my own):** If a user types "Samsung" — that is too vague to get useful results. I proposed a pre-search step: send the raw query to Groq, get back 3–4 refined suggestions ("Samsung phones under ₹20,000", "Samsung Galaxy S series"), user confirms one, then that refined query goes to the actual search. The fallback if Groq fails: a template with placeholders the user fills in. This was verified against Vonnue's conditions — AI refining a search query is a UI convenience, not a decision, so it is allowed.

**Target selection:**

| Option | Decision | Reason |
|--------|----------|--------|
| Amazon.in | Rejected | Aggressive bot detection, CAPTCHA walls, legal exposure |
| Flipkart | Evaluated | Heavy client-side JavaScript rendering — requires Puppeteer, which is heavier |
| Croma | Attempted then dropped | Spec tables are JavaScript-rendered; static HTML scraping returns empty spec tables |
| Reliance Digital | Chosen | Cleaner structure, and a critical native API discovered (see below) |

**Firebase / database:** I proposed caching scraped results so repeated searches for "Samsung S25" don't re-scrape. Claude verified this doesn't violate Vonnue's conditions — it's an infrastructure choice, not cheating. Decision: defer to Phase 3. Keep Phase 2 simpler.

---

### The Croma Problem

Croma was the first scraping target attempted. The scraper was built, tested — and it appeared to work. The results looked plausible. It was not working correctly.

**What was actually happening:** The product spec tables on Croma pages are JavaScript-rendered — the actual spec data loads client-side after the initial HTML. Cheerio only sees the static HTML. The JSON-LD embedded in the page was empty. So the `cromaScraper.js` had nothing to extract.

**How it appeared to work:** A function called `extractSpecsFromTitles()` was using Groq to *infer* specs from the product title text — e.g., "20W Portable Speaker" → `Power: 20`. This is hallucination that happened to look correct. "Power: 20" is accurate for the Marshall Emberton II, but only because 20W was in the product name. Battery life (30h), IP67 rating, Bluetooth 5.1 — none of those were in the title, so they were never extracted. The preview step showed only name, price, and rating, so this gap was invisible.

**Discovery of the actual issue:** The preview step only rendered `name`, `price`, `rating`. I needed to see the full spec table to know what was actually extracted. Once Antigravity fixed the preview to show all scraped fields, the empty spec table was immediately visible.

**Decision:** Drop Croma entirely. It requires Puppeteer (headless browser) to render JavaScript before scraping, which is a much heavier dependency. Focus entirely on Reliance Digital.

---

### The Reliance Digital Native API Discovery

**This was the most valuable technical finding in Phase 2.**

Rather than guessing at HTML structure, I opened Chrome DevTools on the Reliance Digital search page, went to the Network tab, filtered by Fetch/XHR, and watched what requests the page made when a user searched. Among the analytics and tracking traffic, two internal API calls stood out:

- **Search:** `https://www.reliancedigital.in/ext/raven-api/catalog/v1.0/products?q={query}&page_size=12&page_no=1`
- **Product detail:** `https://www.reliancedigital.in/api/service/application/catalog/v1.0/products/{slug}/`

Both returned clean, structured JSON. The search endpoint returns product names, URLs, prices, and ratings for up to 12 results. The product detail endpoint returns a full spec object — 40–50 fields depending on category. This is the same data the website displays in its spec table, just in JSON form.

**Why this is better than HTML scraping:**
- No fragile HTML selectors that break when the site redesigns
- Data is already typed — price is a number, not a string buried inside a `<span class="price">`
- The search endpoint replaces SerpAPI entirely — no external service, no API key, no rate limit charges

**I did not invent this technique.** I found it by watching what the website's own JavaScript does when a user searches. The website calls its own backend. I replicated those same calls from my Node.js server.

**The slug problem:** The product detail API requires a URL slug, not a product ID. The slug looks like: `samsung-80-cm-32-inches-hd-smart-led-tv-black-ua32h4550fuxxl-mcxakn-9285125`. The search results return full page URLs. Slug extraction: take the URL path, strip `/product/`, use what remains, and strip at `?` to remove any query parameters. Getting this wrong caused 404s on every product detail call until the bug was identified.

**The rcp-list dead end:** I also tried the `/ext/raven-api/resq/rcp-list` endpoint found in the network logs. It returned `"User Id is required"` — this is an authenticated internal endpoint not usable without a login session. I documented this and moved on. The catalog API required no authentication.

---

### Scraper Architecture

Two Node.js modules in `backend/scrapers/`:

**`relianceSearch.js`** — calls the catalog search API, returns up to 12 product result objects with name, price, rating, and product page URL.

**`relianceScraper.js`** — given a product page URL:
1. Extracts the slug from the URL
2. Calls the product detail API at `/api/service/application/catalog/v1.0/products/{slug}/`
3. Falls back to Cheerio HTML parsing of JSON-LD if the API is incomplete
4. Merges both sources — price and rating from JSON-LD are reliable; spec fields from the API are richer
5. Returns: name, price, rating, review count, and all spec fields as a flat key-value object (up to 50 fields)

The spec extraction varies by category. Phones return 40+ fields. Earbuds return 14–17. TVs return 40+. The scraper does not assume a fixed set of fields — it extracts everything present and returns the union. The criteria toggle UI then lets the user decide which fields are relevant.

---

### Smart Compare UI Build — February 27–28, 2026

With real scraped data flowing, a new frontend problem appeared: **information overload.**

A scraper phone returns fields like `Item Code`, `Brand`, `Country of Origin`, `Net Weight`, `Commodity Name`, `EAN`, `Item Length`, `Item Width`, `Item Height`, alongside the useful fields like `Processor`, `RAM`, `Battery`, `Price`. Comparing 50 fields is meaningless. Comparing `Country of Origin` (all "India") is pointless.

**My solution:** a criteria toggle system where:
- Each row in the priorities table has a toggle button
- Rows where all products have identical values are automatically greyed out and pre-deselected — the system hides noise by default
- User can click to re-include any row if they want it in the scoring
- Selected rows (green checkmark) go into the decision engine; deselected rows are excluded

**Antigravity handled the implementation.** I wrote the spec describing the toggle behavior and the auto-deselect logic. Antigravity read `script.js` and `styles.css` and applied the changes.

**Bug found after implementation:** The deselect toggle was styled using a CSS class `criteria-row-removed` that applied `display: none` to the entire row — including the toggle button itself. Once a user deselected a row, the button disappeared and there was no way to re-select it. Fix: apply the strike-through style only to the content cells, not the column containing the button.

**Preview step improvement:** The original preview step after scraping only showed `name`, `price`, and `rating` per product — three fields out of potentially 50. The user had no way to see what was actually fetched before the priorities step. Antigravity replaced `renderSmartPreview()` with a full spec table per product, showing every extracted field and marking missing values with `---` in grey. Values inferred from the product title (rather than scraped from the spec table) were labeled `inferred` so users knew to verify them.

---

### Replacing SerpAPI — February 28, 2026

The search route in `server.js` was still using the old SerpAPI integration, which returned 503 because `SERPAPI_KEY` was never set. Now that Reliance's native search API was working, SerpAPI could be removed entirely.

**The implementation problem:** Claude gave me a bash command to patch `server.js` that used `sed`. Windows Command Prompt does not have `sed`. Every line of the command threw `is not recognized as an internal or external command`. This was a straightforward platform confusion — Claude assumed a Unix shell.

Fix: I pasted the new `/api/search` route code directly and verified the current file contents manually. Antigravity made the surgical replacement in the file, removing the SerpAPI block and replacing it with the native Reliance search call.

After the replacement, searching "Airpods" triggered the Reliance catalog API, returned matching products, and scraping proceeded normally.

---

### End State — TV Rendered

The final test session on February 28 confirmed that the full Phase 2 pipeline worked end to end: search query → Reliance API → product URLs → product detail API → spec extraction → Smart Compare UI → criteria selection → decision engine → result with AI explanation.

Terminal output confirmed:
- `[RelianceSearch] "4K TV India" → 8 products (page 1)`
- `[RelianceScraper] JSON-LD Product found: "Hisense 109.22 cm (43 Inch) Ultra HD (4K) Smart TV"`
- `[RelianceScraper] Specs extracted: 41 fields`

TV products rendered in the UI. The Croma scraper was dropped — noted with: *"About Croma.. lets drop that feature."*

---

### Mistakes Made During Phase 2

| Mistake | Impact | How Found | Fix |
|---------|--------|-----------|-----|
| Used `sessionStorage` to pass visualizer data across tabs | Visualizer always fell back to demo, real data never reached it | Console logs showing fallback despite successful calculation | Switched to `localStorage` (shared across same-origin tabs) |
| Validated `d.winner` as truthy | Tied results (winner = null) silently fell back to demo | Antigravity's Sonnet root cause analysis | Changed check to `'winner' in d` — structural not truthy |
| Snapshot of normed values taken after penalty loop | Captured penalty scores instead of normalized values | Code review of timing in `decisionLogic.js` | Moved snapshot to before the penalty loop |
| Chose SerpAPI as search provider without testing free tier | 401 on first request, dev blocked | First test run | Replaced entirely with Reliance native catalog API |
| Attempted Croma before verifying HTML structure | Weeks of effort scraping data that was actually Groq hallucinations | Revealed when preview step was fixed to show full spec table | Dropped Croma; Puppeteer required for JS-rendered specs |
| `sed` command given for patching server.js on Windows | Every command line threw "not recognized" errors | Running the command in Windows CMD | Pasted replacement code directly; Antigravity applied it |
| Slug extraction included query parameters | Malformed slugs caused 404 on every product detail call | Console 404 errors on product fetch | Strip at `?` before using slug |
| Preview showed only name/price/rating | Spec extraction gaps were invisible, Groq hallucinations appeared to be scraping | Fixed preview to show full spec table | Rewrote `renderSmartPreview()` to display all extracted fields |

---

### Current State (Updated)

**Phase 1 — Complete ✅** Generic decision system, direction-aware penalty scoring, normalization, weighted ranking, tie detection, 5-step web wizard, AI explanations with 4 styles and offline fallback.

**Phase 1.5 — Complete ✅** 3 input types, preprocessing pipeline, Approval Stage, source badges, confidence indicators, AI failure handling with manual override.

**Visualizer — Complete ✅** Integrated with real `/api/calculate` data. Pixi.js WebGL renderer, fireball spritesheets, analyst narrator, auto-follow camera, 5+ candidate support with cyclic character assignment.

**Phase 2 — In Progress ⚙️** Reliance Digital search + product scraper working. Smart Compare tab with criteria toggle and full spec preview built. SerpAPI replaced with native Reliance catalog API. TV product rendering confirmed end-to-end. Remaining: keyword refinement with Groq pre-search, AI-suggested ideal values, broader category testing.

**Phase 3 — Planned** Customer review analysis from multiple sources.

---


## Phase 2.5 — Decision Memory + Algorithm Fixes
### March 1, 2026

---

### What Phase 2.5 Was

Phase 2.5 was never originally planned. It emerged from two separate problems discovered after Phase 2 was committed:

1. Every comparison result disappeared the moment the user started a new one — no history
2. The core algorithm had three silent bugs that gave wrong results in edge cases

Both were fixed in the same session. Firebase Firestore was added for memory persistence. The algorithm bugs were patched in `decisionLogic.js`.

---

### Decision Memory — Firebase Firestore

**The requirement I identified:** Users run a comparison, see the result, close the tab, and lose everything. For a decision tool, that is a design failure. A decision that took 5 minutes to set up should be replayable.

**Technology choice — Firebase Firestore:**
- Free tier, no server infrastructure, works from the browser via SDK
- Chosen over: PostgreSQL (requires a server), localStorage (device-only, no persistence across devices), plain JSON file (no concurrent access)
- Project name: `vonnue-decision-maker`, test mode, no authentication

**`backend/services/memoryService.js`** was built as a standalone module with:
- `saveComparison(payload)` — writes to Firestore, enforces 20-entry cap by deleting oldest
- `listComparisons()` — returns all entries sorted by timestamp descending
- `deleteComparison(id)` — removes one entry
- `renameComparison(id, newTitle)` — patches title field only
- In-memory fallback array — if Firebase is unavailable, all operations work against a local array with no user-visible error

**The in-memory fallback was important.** Firebase initialisation can fail silently if `FIREBASE_API_KEY` is wrong or missing. Rather than crashing, the system degrades gracefully — comparisons are still saved for the session, they just don't persist across tabs or refreshes. The user never sees an error.

**Title generation problem:** `generateTitle()` was initially just `"Alice vs Bob vs Charlie"`. Two comparisons of the same products had identical titles in the Memory tab. This was not caught until Phase 2.6 testing.

Fix (Phase 2.6): append `(HH:MM)` timestamp to every title. Two comparisons at the same clock minute are astronomically unlikely. If they do collide, the user can rename either one inline.

```js
// Before — titles collide
return joined; // "Alice vs Bob vs Charlie"

// After — unique by time
return `${joined} (${timeStamp})`; // "Alice vs Bob vs Charlie (14:32)"
```

---

### Tab Switching Bug

**The bug:** The app has 3 tabs — Manual Compare, Smart Compare, Memory. After Phase 2.5 was integrated, clicking the Memory tab showed a blank white area. The tab was switching but no content was visible inside it.

**Root cause:** The Memory tab content div `#tab-memory` existed in `index.html` but the `switchTab()` function only knew about 2 tabs (`manual` and `smart`). It was not adding or removing the `hidden` class on the third tab.

**Fix:** Extended `switchTab()` to handle `'memory'` as a valid case, show `#tab-memory`, and hide the others.

**What I learned:** When adding a new UI section, always check whether any existing routing/navigation logic needs to be updated. The `switchTab` function was a hard-coded list, not dynamic.

---

### Algorithm Fixes — Three Silent Bugs

These bugs existed since Phase 1 but only surfaced in edge cases during Phase 2 testing with real scraped data.

**Bug 1 — Ideal value clamping**

The ideal value entered by the user was normalized using the product min/max range. If the ideal fell outside the range of compared products, the normalized ideal could be below 0 or above 100.

Example: Products have prices ₹15,000–₹25,000. User enters ideal ₹10,000 (cheaper than all options). Normalized ideal = negative number. Penalty calculations became wrong — products with lower prices were being penalized instead of rewarded.

Fix: `normIdeal = Math.max(0, Math.min(100, normIdeal))` — clamp to [0, 100].

**Bug 2 — Identical features**

When all compared products had the exact same value for a criterion (e.g. all had "Android 13"), the min/max normalization produced `0/0 = NaN`. Every penalty calculation for that criterion returned NaN, which propagated through the weighted sum and produced NaN as the final score.

Fix: Detect when all values are identical before normalizing. If `max === min`, set penalty = 0 for all products on that criterion — they're all equally good, no differentiation possible.

**Bug 3 — Tie threshold**

Ties were detected with threshold `0.001` — two scores had to be within 0.001 points to be considered a tie. With weighted penalty scores ranging 0–100, `0.001` was effectively `0`. No ties were ever detected even when scores were meaningfully equal.

Fix: Raised threshold to `1.0` — scores within 1 point of each other are shown as a tie.

---

### Manual Comparisons Auto-Saved

Originally only Smart Compare results were saved to Memory. Manual Compare results disappeared.

Fix: Added `saveToMemory()` call at the end of `calculateResult()` in `script.js`, same call that already existed for Smart Compare. Both paths now write to the same `memoryService`.

---

## Phase 2.6 — Visualizer Images + Comparison Details Panel
### March 1, 2026

---

### Task 1 — Product Images in Visualizer

**The problem I identified:** Smart Compare compares real products. The visualizer shows anime character sprites standing on platforms. The character sprites make sense for Manual Compare (abstract candidates like "Alice" and "Bob"). For Smart Compare they are visually disconnected — the platform says "Samsung Galaxy A17" but the character is a generic anime figure. Immersion breaks.

**What I wanted:** When a product image is available, replace the sprite with the actual product thumbnail. Maintain the sprite + full emotion system for any product without an image, and for all Manual Compare.

---

#### Data Flow Design

The key insight was that product images already existed in `smartState.searchResults` as the `thumbnail` field. The problem was purely plumbing — getting those URLs from `script.js` into the visualizer iframe.

```
smartState.searchResults[i].thumbnail
  → vizImages map { productTitle: imageUrl }
    → window.__VISUALIZER_DATA__.images
      → DEMO.images inside iframe
        → PIXI.Assets.load(url)
          → productTextures[i]
            → used in spawnChars() instead of charTex[i]
```

---

#### Mistakes Made During Task 1

**Mistake 1 — Wrong field name**

First version of the image map builder used `p.name`:
```js
if (p.name && p.thumbnail) vizImages[p.name] = p.thumbnail;
```
The actual field on `searchResults` objects is `p.title`, not `p.name`. `name` is undefined on every object. Result: `images` was always `{}`.

Found by: `console.log(JSON.stringify(smartState.searchResults?.[0]))` — immediately showed `title` not `name`.

**Mistake 2 — Key mismatch between images map and DEMO.candidates**

After fixing the field name, `DEMO.images` had URLs keyed by full product titles like:
```
"Samsung 108 cm (43 inches), Crystal 4K Ultra HD Smart LED TV, Black, UA43UE81AFULXL"
```

But `DEMO.candidates` (the product names used inside the visualizer) were shortened names like:
```
"Samsung Crystal 4K Ultra HD Smart LED TV 43"
```

Exact match lookup always failed. `productTextures` stayed null for every candidate.

Found by:
```js
iframe.contentWindow.eval(`
  DEMO.candidates.forEach((c, i) => console.log(i, '| match:', !!DEMO.images[c], '|', c));
`);
```

Fix: Fuzzy word-overlap lookup. Split candidate name into words, count how many appear in each image key, pick highest score, require ≥ 2 matches:
```js
const candidateWords = DEMO.candidates[i].toLowerCase().split(/[\s\-]+/);
let bestKey = null, bestScore = 0;
for (const key of Object.keys(DEMO.images)) {
  const matches = candidateWords.filter(w => w.length > 2 && key.toLowerCase().includes(w)).length;
  if (matches > bestScore) { bestScore = matches; bestKey = key; }
}
return bestScore >= 2 ? DEMO.images[bestKey] : null;
```

Splitting on hyphens as well as spaces was important — `"15-Fb3124AX"` as one token never matched anything; split into `"15"` + `"fb3124ax"` gave two chances to match.

**Mistake 3 — Accessing iframe variables from parent console**

Multiple failed attempts at `vizWin.DEMO` from the parent window console. `DEMO` is a `const` declared inside the iframe's `<script>` tag — it does not attach to `window`. Only `window.eval()` can reach it:
```js
iframe.contentWindow.eval('JSON.stringify(DEMO.images)')
```

This is not a mistake in the code — it is a JavaScript scoping fact worth documenting. `const` and `let` at module/script scope are not properties of `window`.

**Mistake 4 — iframe selector returning null**

Repeatedly got `Cannot read properties of null (reading 'contentWindow')` because:
- The visualizer overlay was closed before running the console command
- `const iframe = ...` declared in a previous console session does not persist — must re-declare every session

**Mistake 5 — `window.__VISUALIZER_DATA__` undefined inside iframe**

The visualizer sets data on `window.parent.__VISUALIZER_DATA__` (the parent window), then reads it back via `window.__VISUALIZER_DATA__ || window.parent.__VISUALIZER_DATA__`. Checking `iframe.contentWindow.__VISUALIZER_DATA__` from outside always returned undefined — the iframe's own `window.__VISUALIZER_DATA__` is never set; only the parent's is.

---

#### PIXI.js Integration Detail

The visualizer uses PIXI.js (v7.3.2) WebGL renderer. Characters are `PIXI.Sprite` objects loaded from local PNG files. The sprite system:

- `charTex[i]` — object of `{ emotion: PIXITexture }` per candidate index
- `charSprites[i]` — the live PIXI.Sprite on screen
- `setEmo(i, emo)` — swaps `charSprites[i].texture` to the emotion frame

For product images:
- Added `productTextures[i]` array, initialized to `null`
- In `loadTextures()`: if `DEMO.images[DEMO.candidates[i]]` resolves (via fuzzy match), load it as a PIXI texture into `productTextures[i]`
- In `spawnChars()`: use `productTextures[i] || charTex[i]['normal']` — product image takes priority
- In `setEmo()`: early return if `productTextures[i]` is set — product photos don't change expression

This means for Smart Compare, product image candidates are static (no emotional reaction). For Manual Compare or products without images, the full emotion system runs unchanged.

---

### Task 2 — Comparison Details Panel

**The problem:** After the decision engine runs and shows the winner, the user sees a ranking list and a detailed breakdown section — but the breakdown only shows penalty × weight per criterion, not the raw values. There was no way to see "what was the actual price of product B?" or "which spec was better?" in a clear table. Also, any spec that failed the ≥50% coverage threshold was silently discarded — the user had no idea which specs were available but excluded.

---

#### Architecture Decision — Where to Put the Button

Two options considered:

Option A: A separate collapsible panel below the results section  
Option B: A single button next to the "Complete Ranking" heading, toggling one table inline

Option B was chosen. Option A required adding a new div to `index.html` in the exact right position and managing its visibility separately. Option B puts everything inside `displayResults()` — no new HTML structure needed, the panel is generated and injected at render time.

**Later refinement:** Initially implemented as per-row buttons (one 👁 Details button per candidate in the ranking list). This was wrong — all 5 buttons showed the identical full table. One button was correct. Removed per-row buttons, added one `📋 Comparison Table` button next to the h3.

---

#### The Nested div Bug

`renderDetailsRow()` returned:
```html
<div class="det-panel">
  <table>...</table>
</div>
```

But the call site in `displayResults()` already wrapped it in another `<div class="det-panel">`:
```html
<div class="det-panel open">          ← toggled by button
  <div class="det-panel">             ← returned by renderDetailsRow
    <table>...</table>                ← CSS: display:none, never gets .open
  </div>
</div>
```

The inner `.det-panel` had `display:none` from CSS and never got the `.open` class added to it. Table was invisible. The div had height 16px (its own padding) but no visible content.

Found by: calling `renderDetailsRow(...)` directly in console — the HTML was generated correctly. The bug was structural nesting, not logic.

Fix: Change `renderDetailsRow` to return a plain `<div>` wrapper, not `<div class="det-panel">`. The outer panel is already provided by the call site.

---

#### ruled_out "Only 0 of N" Bug

The ruled-out section showed `"Only 0 of 5 products had this"` for every spec. The count was always 0.

Root cause: The count check looked in `products_data`, which only has the *short names* of selected products. The ruled-out specs were scraped specs that failed the ≥50% threshold — they were dropped *before* `products_data` was built. So checking `products_data[candidate][spec]` always returned undefined.

The specs genuinely had 0 presence in `products_data` — they just never made it into that object. The message was technically accurate but misleading.

Fix: Change message to `"Not available in selected products"` instead of the count — cleaner and honest.

---

#### View Products Reference Button

**The user problem:** When filling in ideal values (Step 4 for Manual Compare, "Set Priorities" for Smart Compare), the actual product values are on a previous step. The user must remember or go back.

**Fix:** A `📦 View Products` toggle button in the top-right of both ideals steps. Clicking it shows a compact raw values table — all products × all criteria — as a reference. No ideal column, no tick marks, no scoring. Pure reference.

For Smart Compare: table is built at the start of `showSmartIdeals()` from `smartState.scrapeResult.products_data`.

For Manual Compare: table is built at the start of `generateIdealsForm()` from `state.products`, which is already fully populated when Step 4 renders.

---

#### Tab Switching After Comparison (Cross-Tab Bug)

**The bug:** After completing a Manual Compare, switching to Smart Compare showed a blank area. After completing a Smart Compare, switching back to Manual had the same problem.

**Initial hypothesis:** The ID-swap bug — `displayResults()` temporarily renames `results-container` to `smart-results-container` and back. If it throws mid-execution, the IDs stay swapped permanently.

**Actual root cause:** The ID swap was fine. The real issue was `showAmazonStep()` being called during smart result rendering, which stripped `active` from all smart steps including `step-smart-search`. When the user later switched to the Smart tab, no step had `active` — blank.

**Fix:** In `switchTab()`, if switching to `'smart'` and no step inside `#tab-smart` has the `active` class, force `step-smart-search` active:
```js
if (tab === 'smart') {
  const hasActive = document.querySelector('#tab-smart .step.active');
  if (!hasActive) {
    document.getElementById('step-smart-search').classList.add('active');
  }
}
```

**The try/finally wrap** was added anyway as a safety net — the ID swap genuinely would cause issues if `displayResults()` ever threw:
```js
try {
  displayResults(result);
} finally {
  smartContainer.id = 'smart-results-container';
  main.id = 'results-container';
}
```

---

### Tool Change — VS Code Copilot Agent (Haiku)

From Phase 2.6 onward, file edits were applied using **VS Code Copilot Agent in Agentic mode with Claude Haiku** rather than Antigravity.

Observations:
- Haiku in agentic mode was fast and accurate for surgical find-and-replace edits
- It read files directly from the workspace — no need to paste file contents into a chat
- Claude (Sonnet, this chat) handled planning, debugging, and console diagnosis; Haiku handled execution
- The separation worked well: Sonnet for reasoning, Haiku for applying

This is an effective pattern for codebases where the planning and the typing are different cognitive tasks.

---

### What Could Have Been Done Differently

**1. Fuzzy matching should have been built from the start**

The image key mismatch was predictable. The short names used as `DEMO.candidates` were generated by `cleanName` logic in the scraper — they were never going to match full product titles exactly. A fuzzy lookup should have been part of the initial design, not a debugging fix.

**2. The per-row Details button was a wrong first instinct**

Five identical tables behind five buttons is bad UX. One table behind one button was obviously correct in retrospect. The initial plan described per-row buttons; the right design should have been spotted before implementation.

**3. `state.ideals` overwrite for review criteria**

`state.ideals` gets overwritten with `ideals.map(v => typeof v === 'string' ? 10 : v)` before `displayResults()` runs. The Ideal column in the comparison table then shows `10` for every review-type criterion instead of the actual text like `"Excellent build quality"`. 

Fix: pass raw ideals separately into `renderDetailsRow` from `smartState.pendingCalc.ideals` before they are coerced. This was identified but not fully implemented before the deadline.

**4. ruled_out count was misleading from day one**

`"Only 0 of 5 products had this"` was always going to be wrong because ruled-out specs never enter `products_data`. The message should have been `"Not available in selected products"` from the start. A moment of thinking about data flow before writing the message would have caught this.

**5. Memory titles should have been unique from day one**

`generateTitle()` producing duplicate titles for repeated comparisons was a foreseeable problem. A timestamp or incrementing counter should have been part of the initial implementation, not a patch.

**6. Cross-tab state contamination**

The ID-swap trick (`main.id = '__hidden'`) is fragile. A cleaner approach would have been a dedicated result rendering container that both Manual and Smart tabs share by reference, rather than temporarily renaming DOM elements. This worked but it is not a good pattern — it is side-effect-based DOM manipulation that is hard to reason about.

---

### Current State After Phase 2.6

| Feature | Status |
|---------|--------|
| Manual Compare — full flow | ✅ |
| Smart Compare — Reliance Digital search + scrape | ✅ |
| AI-suggested ideal values + criteria weights | ✅ |
| Decision Memory — Firebase + fallback | ✅ |
| Memory — save, load, delete, rename, replay, animate | ✅ |
| Visualizer — product images for Smart Compare | ✅ |
| Visualizer — sprite + emotion system for Manual Compare | ✅ |
| Comparison details table in results | ✅ |
| Ruled-out specs display | ✅ |
| View Products reference button on ideals step | ✅ |
| Tab switching bug | ✅ |
| Ideal column in details table (review criteria) | ⚠️ Partial — shows 10 for review criteria |
| Phase 3 — review analysis | ❌ Not attempted |

---

### Git Commit

```
Phase 2.5 + 2.6 complete — memory, algorithm fixes, visualizer images, details panel
```

Files changed in this phase: `server.js`, `decisionLogic.js`, `script.js`, `index.html`, `styles.css`, `visualizer_prototype.html`, `backend/services/memoryService.js`, `backend/scrapers/relianceSearch.js`

---

## What I Would Do Differently

1. Start documentation from Day 1, not catch up later
2. Write test cases before writing the algorithm (test-driven approach)
3. Draw an architecture diagram before coding
4. Commit after every small working change, not in large batches
5. Set up `.gitignore` before the first commit
6. Research API rate limits before building features that depend on free-tier APIs