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



---

## Phase 2.5 — Decision Memory
### March 1, 2026

---

### Why This Feature Exists

After Phase 2.0, every comparison ran and disappeared. The user had no way to revisit a past result, compare their thinking across sessions, or refer back to what the system recommended last week. For a decision companion, this is a gap — decisions are rarely made in one sitting.

The name I chose was **Decision Memory**, not "History." History is passive. Memory implies the system retains something on your behalf.

---

### Architecture Decision — Firebase vs localStorage

Two options:

| Option | Pros | Cons |
|--------|------|------|
| localStorage | Zero setup, instant to build, no credentials | Clears on browser wipe, device-specific |
| Firebase Firestore | Persists reliably, survives browser wipes | Requires setup, credentials to manage |

I chose **Firebase** for the hosted version, with an in-memory fallback if the env vars are missing. The fallback means the system degrades gracefully — Memory still works during local development without a Firebase project configured.

**Why not a full account/login system:** Not worth building for a take-home deadline. Device-based identity (Firebase credentials in `.env`) is sufficient for the use case.

**Firebase project created:** `vonnue-decision-maker` (separate from my hotel booking learning project). Firestore in test mode. Collection: `comparisons`.

---

### Data Shape Design

Each saved comparison stores:

```json
{
  "title": "Samsung A17 vs F17",
  "timestamp": "2026-03-01T...",
  "source": "smart",
  "winner": "Samsung Galaxy A17 5G",
  "products": ["Samsung Galaxy A17 5G", "Samsung Galaxy F17 5G"],
  "criteria": ["Price (₹)", "Rating (out of 5)", "RAM"],
  "criteriaCount": 3,
  "result": { },
  "products_data": { }
}
```

The full `result` and `products_data` are stored so any comparison can be fully replayed later — including re-running the animation.

---

### Auto-Generated Titles

Titles are generated from product names: "Samsung A17 vs F17" for 2 products, "Samsung A17 +2 more" if names are too long. The title is editable — clicking it in the Memory tab converts it to an inline input field. Press Enter to save, Escape to cancel. Same UX pattern as renaming a chat in ChatGPT.

---

### Implementation

**New file:** `backend/services/memoryService.js` — all Firebase read/write isolated in one service. Four functions: `saveComparison`, `listComparisons`, `deleteComparison`, `renameComparison`.

**New routes in `server.js`:**
- `POST /api/memory/save`
- `GET /api/memory/list`
- `DELETE /api/memory/:id`
- `PATCH /api/memory/:id`

**Frontend:** Memory tab added as third tab. Auto-save triggered at end of both `_finishSmartCalculation()` and `runCalculate()`. "View Result →" replays full breakdown. "🎬 Animate" passes saved data into the visualizer.

---

### Tab Switching Bug Fix

During Phase 2.5 HTML work, the long-standing tab switching bug was fixed. Both tabs were visible simultaneously because `.tab-content.hidden` had no `display: none` rule — the `hidden` class existed but was not hiding anything.

Root cause: `tab-manual` div used `class="container"`, not `class="tab-content"`. `hidden` was added but the CSS rule `.tab-content.hidden { display: none !important; }` never matched it.

Fixes applied:
1. Added `tab-content` class to `tab-manual` div in `index.html`
2. Added `.tab-content.hidden { display: none !important; }` to `styles.css`
3. Old `switchTab()` function (using `.classList.toggle`) replaced with explicit `.add('hidden')` / `.remove('hidden')` version

---

### Mistakes Made During Phase 2.5

| Mistake | Impact | Fix |
|---------|--------|-----|
| Only added `saveToMemory()` to Smart Compare flow | Manual comparisons not saved | Added same call inside `runCalculate()` |
| Old `switchTab` not fully removed — two definitions existed | Tab switching still broken after first attempt | Searched for all occurrences, deleted old toggle-based version |
| `tab-manual` missing `tab-content` class | `.hidden` never matched the CSS rule | Added `tab-content` class to the div |

---

### Algorithm Fixes — Phase 2.5

While reviewing `decisionLogic.js` four bugs were identified and fixed:

**Bug 1 — Ideal out of range**

If the user's ideal falls outside the range of compared products (e.g., ideal price ₹50,000 but both products cost ₹70,000–₹80,000), the normalization formula produces a negative normalized ideal. `Math.max(0, ...)` then clamps all penalties to zero, making every product appear to perfectly meet the ideal. The cheaper product gets no advantage.

Fix: Clamp normalized ideal to `[0, 100]`:
```js
const raw = ((req_list[i] - min_v) / (max_v - min_v)) * 100;
norm_req_list.push(Math.min(100, Math.max(0, raw)));
```

**Bug 2 — Identical features produce phantom penalties**

When all products share the same value for a criterion, the old code normalized all values to 50 — but if the user's ideal was different from 50, every product received a penalty on a criterion where no differentiation was possible.

Fix: Track identical features in a `Set`. If `max === min`, set penalty = 0 for all products on that feature regardless of ideal.

**Bug 3 — Tie threshold too tight**

Ties were checked with `abs(score - mvp_score) < 0.001`. With floating point penalty scores ranging 0–100, this effectively meant ties were never detected.

Fix: Raised threshold to `1.0`.

**Bug 4 — Review criteria ideal anchored to 10**

For AI-scored review criteria, the ideal was hardcoded as `10`. If the best available product only scores `7/10`, it still gets penalized for not being a perfect 10.

Fix: Set ideal to `Math.max(...validScores)` — best available score becomes the anchor.

---

### Tool Change Discovery

During this session I discovered that **Antigravity** — the IDE I had been using for file edits — runs **Claude Haiku** (via VS Code Copilot in agentic mode), not Gemini as I had assumed. The model selector shows Claude Haiku 4.5 as active.

The workflow remains the same: Claude Sonnet (this chat) plans and writes `.md` instruction files; Haiku in the IDE reads and applies them to actual project files. The separation worked well — Sonnet for reasoning, Haiku for execution.

---

## Phase 2.6 — Visualizer Product Images + Comparison Details Panel
### March 1–2, 2026

---

### Task 1 — Product Images in Visualizer

The visualizer uses PIXI.js sprite characters with emotion frames. For Smart Compare, these generic anime sprites made no sense — the platform said "Samsung Galaxy A17" but the character was a random anime figure. I wanted actual product thumbnails to replace the sprites when available.

The product images already existed in `smartState.searchResults` as `thumbnail` URLs. The problem was entirely plumbing — getting those URLs into the visualizer iframe.

**Data flow I designed:**
```
smartState.searchResults[i].thumbnail
  → vizImages map { productTitle: imageUrl }
    → window.__VISUALIZER_DATA__.images
      → DEMO.images inside iframe
        → PIXI.Assets.load(url) → productTextures[i]
          → spawnChars() uses productTextures[i] || charTex[i]['normal']
```

**Mistake 1 — wrong field name.** First version used `p.name` but the field on searchResults objects is `p.title`. The images map was always `{}`. Found by console logging `searchResults[0]`.

**Mistake 2 — key mismatch.** After fixing the field name, `DEMO.images` had full titles as keys (`"Samsung 108 cm (43 inches), Crystal 4K Ultra HD Smart LED TV, Black, UA43UE81AFULXL"`) but `DEMO.candidates` used shortened names (`"Samsung Crystal 4K Ultra HD Smart LED TV 43"`). Exact match always failed.

Found with:
```js
iframe.contentWindow.eval(`
  DEMO.candidates.forEach((c,i) => console.log(i, '| match:', !!DEMO.images[c], '|', c));
`);
```

Fix: fuzzy word-overlap lookup — split candidate name on spaces and hyphens, count how many words appear in each image key, require score ≥ 2:
```js
const candidateWords = DEMO.candidates[i].toLowerCase().split(/[\s\-]+/);
```
Splitting on hyphens as well as spaces was important — `"15-Fb3124AX"` as one token never matched anything.

**Mistake 3 — accessing iframe variables from parent console.** `const DEMO` inside the iframe's script tag does not attach to `window`. Had to use `iframe.contentWindow.eval(...)` to reach it. Lost time on this.

**Mistake 4 — iframe selector returning null.** Multiple failed attempts because the visualizer overlay was closed before running the console command, or `const iframe` declared in a previous console session didn't persist.

For Manual Compare: full sprite + emotion system unchanged. For Smart Compare products without images: sprite fallback. `setEmo()` returns early if `productTextures[i]` is set — product photos don't change expression.

Result: 2 of 3 images rendered on first working attempt. Third failed due to key mismatch — fixed by the fuzzy matcher.

---

### Task 2 — Comparison Details Panel

After the decision engine ran, the user could only see penalty × weight per criterion in the breakdown. No way to see raw values, no way to know which specs were dropped. I wanted a table showing all products × all criteria with the best value marked, plus a ruled-out section showing specs that failed the ≥50% threshold.

**Architecture decision — one button, not per-row.** I initially implemented per-row 👁 Details buttons (one per candidate in the ranking list). Every button showed the identical full table. One `📋 Comparison Table` button next to the h3 was obviously correct. Removed the per-row buttons — should have seen this before implementation.

**The nested div bug.** `renderDetailsRow()` returned `<div class="det-panel">...</div>` but the call site already wrapped it in `<div class="det-panel open">`. The inner panel had `display:none` from CSS and never received `.open`. The div had 16px height (padding) but no visible content.

Found by calling `renderDetailsRow(...)` directly in console — the HTML was correct. Structural nesting, not logic.

Fix: return a plain `<div>` wrapper from `renderDetailsRow`, not `<div class="det-panel">`.

**ruled_out count was always 0.** The count check looked in `products_data` for each ruled-out spec. Those specs were dropped before `products_data` was built — they never entered it. Every spec showed `"Only 0 of N products had this"`. Fixed message to `"Not available in selected products"`.

**state.ideals overwrite loses review criteria text.** Before `displayResults()` runs, `state.ideals` is overwritten with `ideals.map(v => typeof v === 'string' ? 10 : v)`. The Ideal column shows `10` for every review-type criterion instead of the actual text. Identified but not fully fixed before deadline — `renderDetailsRow` needs to receive raw ideals from `smartState.pendingCalc.ideals` before coercion.

**Works for both Manual and Smart Compare.** The button uses `smartState.scrapeResult?.products_data || state.products` — Smart Compare data falls through to Manual Compare data automatically.

---

### View Products Reference Button

On both the Smart Compare "Set Your Priorities" step and the Manual Compare "Define Ideal Values" step, the user had to navigate back to see product values while filling in ideals. Added a `📦 View Products` toggle button in the top-right of both steps showing a compact raw values table — all products × all criteria, no scoring, no ideal column, pure reference.

Smart Compare: populated at start of `showSmartIdeals()` from `smartState.scrapeResult.products_data`.

Manual Compare: populated at start of `generateIdealsForm()` from `state.products`, which is fully populated by Step 4.

---

### Cross-Tab State Bug

After completing a Manual Compare then switching to Smart Compare, the Smart tab showed a blank area. The `switchTab()` function showed the right div but nothing inside it was visible.

**Initial hypothesis was wrong.** I suspected the ID-swap bug (`results-container` temporarily renamed to `smart-results-container`). Checked the IDs — both correct. The real issue was `showAmazonStep()` stripping `active` from all smart steps including `step-smart-search`. Switching to the Smart tab later found no step with `active` — blank.

Fix: in `switchTab()`, if switching to `'smart'` and no step has `active`, force `step-smart-search` active.

Added `try/finally` around the ID swap anyway as a safety net.

---

### Minor Fixes This Session

**Duplicate comparison titles.** `generateTitle()` produced identical titles for repeated comparisons. Fixed by appending `(HH:MM)` timestamp to every title.

**Product limit raised from 5 to 8.** The original `urls.length > 5` validation was conservative. Raised to 8. The comparison table has no hardcoded column limit.

**Search results raised from 12 to 20.** Changed `page_size` parameter in `relianceSearch.js`.

**Subtitle text corrected.** "Select 2–5 to compare" updated to "Select 2–8 to compare."

---

### Tool Used This Session

File edits applied via **VS Code Copilot Agent in agentic mode (Claude Haiku)**. Claude Sonnet (this chat) planned, diagnosed, and wrote instruction `.md` files. Haiku read and applied them to project files. The separation worked well for this session — Sonnet for reasoning, Haiku for execution.

---

### What I Would Do Differently

**1. Fuzzy matching should have been the first design, not a debugging fix.** The key mismatch between short candidate names and full image title keys was predictable. The `cleanName` logic in the scraper always produces shortened names — they were never going to match full product titles. A fuzzy lookup should have been part of the initial spec.

**2. One table button was obviously correct from the start.** Five identical tables behind five buttons is bad UX. I should have caught this during design, not after implementation.

**3. The ID-swap trick is fragile.** Temporarily renaming DOM elements (`main.id = '__hidden'`) is a side-effect-based pattern that is hard to reason about. A dedicated shared result container would be cleaner.

**4. ruled_out count message should have been thought through before writing.** One moment of tracing where `products_data` is built would have caught that ruled-out specs never enter it.

---

### Feature Status Update

| Feature | Status |
|---------|--------|
| Product images in visualizer (Smart Compare) | ✅ |
| Sprite + emotion system (Manual Compare) | ✅ |
| Comparison details table in results | ✅ |
| Ruled-out specs panel | ✅ |
| 📦 View Products button — Smart Compare ideals | ✅ |
| 📦 View Products button — Manual Compare ideals | ✅ |
| Cross-tab blank state bug | ✅ |
| Unique comparison titles | ✅ |
| Product limit raised to 8 | ✅ |
| Ideal column for review criteria in details table | ⚠️ Shows 10 instead of text |

---

### Git Commit

```
Phase 2.6: product images in visualizer, comparison details panel, UX fixes
```

---

## Phase 2.6 — Scale Bug Fix, Gemini Integration, Form Validation, UI Polish
### March 1–2, 2026

---

### Task 1 — Scale Criteria False Tie Bug

The algorithm was producing a 3-way tie between Aaron, Bijo, and Cijo when Cijo should have won outright. The detailed breakdown showed `Communication: ScalePenalty: 0.00` for Aaron despite Aaron scoring "Very Good" (9) against an ideal of "Excellent" (10). A penalty of zero when there should have been one.

The root cause was in `preprocessInputs` in `decisionLogic.js`. The ideal value for scale criteria was mapped via:

```js
scored_ideals[fi] = SCALE_MAP[ideals[fi]] ?? 5;
```

The frontend was sending the scale ideal as a number (`10`) rather than the label string (`"Excellent"`). `SCALE_MAP[10]` returns `undefined`, fallback kicks in, ideal becomes `5`. In `calculateDecision`, ideal `5` normalizes to `((5-9)/(10-9))*100 = -400`, clamped to `0`. With ideal at `0` and direction "higher is better", penalty formula `max(0, 0 - normalizedValue)` always returns `0`. The entire criterion became meaningless.

Fix: guard the mapping to handle numeric ideals:

```js
const rawIdeal = ideals[fi];
scored_ideals[fi] = (typeof rawIdeal === 'string' && SCALE_MAP[rawIdeal] !== undefined)
  ? SCALE_MAP[rawIdeal]
  : (parseFloat(rawIdeal) || 5);
```

**Second part of the same bug — direction.** Even after fixing the ideal, if the user accidentally selected "lower is better" for a scale criterion, the same false tie could occur. Products scoring below the ideal get zero penalty in a lower-is-better direction. For scale criteria this is always wrong — Excellent is always better than Poor, the label names encode this. I added a direction override in `/api/preprocess` in `server.js`. After the `preprocessInputs` call, before sending the response:

```js
const corrected_directions = directions.map((dir, i) =>
  feature_types[i] === 'scale' ? 'True' : dir
);
```

`/api/preprocess` is the only route where both `feature_types` and `directions` are available simultaneously. `/api/calculate` never receives `feature_types` — the fix couldn't go there. `preprocessInputs` doesn't receive `directions` — couldn't go there either. The seam was forced.

---

### Task 2 — Gemini Never Working

Gemini had been set as primary for explanation generation since the beginning of the project. It had never once produced an explanation — always falling back to Groq with a 429 error. I assumed rate limiting or quota, but the Google AI Studio dashboard showed near-zero actual usage. On March 1 it showed a 100% success rate spike, meaning the API was reachable.

**Attempt 1 — assumed geo-restriction.** Tried to confirm via curl from Windows CMD. I sent a bash command with backslash line continuation — doesn't work on CMD. Got `000` response code which could mean connection failure or just a bad command. Wasted time on this.

**Attempt 2 — wrong root cause entirely.** Another project I had (`visual_python_gemini_working_server.js`) used the same Gemini API from the same machine and worked correctly. That server used `const fetch = require('node-fetch')` at the top level. My `decisionLogic.js` had no fetch import at all — it used Node's native global `fetch`. `server.js` had `const fetch = require('node-fetch')` at line 3, which is why Groq always worked — those calls went through server.js. But `decisionLogic.js` is a separate module. Its fetch calls used Node's native fetch, which behaves differently from node-fetch at the network level.

Fix: set `global.fetch = fetch` in `server.js` immediately after the require. One line. `decisionLogic.js` then finds `fetch` in global scope — the same working instance that Groq uses.

**Model string mismatch.** The working reference project used `gemini-2.5-flash`. My code used `gemini-2.0-flash`. After switching:

- `gemini-2.0-flash` → 429 (rate limited on free tier)
- `gemini-2.5-flash` with no extra config → short truncated output (~84 chars, cut mid-sentence)

**Thinking tokens.** `gemini-2.5-flash` has thinking mode. Thinking tokens consume from `maxOutputTokens` before the actual response gets any budget. With `maxOutputTokens: 260`, almost nothing was left for visible output. First attempt to fix: added `thinkingConfig: { thinkingBudget: 0 }` outside `generationConfig` → 400 error. Second attempt: moved it inside `generationConfig` and raised `maxOutputTokens: 1024` → works. Full paragraph explanations rendering correctly.

**Prompt was being copied literally.** Even after token budget was fixed, Gemini kept returning one-sentence responses that matched the example in the prompt:
```
Example: "${winner} had the best Price at X and its Quality was Y."
```
Groq ignores examples. Gemini follows them precisely. Removed the example entirely, added explicit instruction: "Write exactly 4-5 sentences... Do NOT write just one sentence."

**Review scoring Gemini calls were blowing the RPM limit.** With N products and review-type features, `extractScoreFromText` fires N Gemini calls with only 200ms gaps. By the time `generateExplanation` ran, Gemini was already throttled. Moved review scoring to Groq-only. Gemini now gets a clean window for the explanation, which is the one place the quality difference is noticeable.

---

### Task 3 — Form Input Restrictions

Three issues: options accepting non-integers, weight accepting any value, direction select always active for scale/review.

**Whole number options.** `parseInt("3.6")` returns `3`, so `Number.isInteger(3)` is `true` and the check passed. The fix required reading the raw string value before parsing and checking for `"."` before calling parseInt. Setting `step="1"` in the HTML input prevents spinner clicks from producing decimals but doesn't block typed values.

**Weight 1–10.** Changed label from "Importance (1-5)" to "Importance (1–10)", set `min="1" max="10" step="0.1"`. Added JS validation: range check and `Math.round(weight * 10) !== weight * 10` to catch more than one decimal place. `step="0.1"` in the input doesn't block typed values like `3.5555` — the JS check does.

**Direction lock for scale and review.** Added logic to `updateTypeHint()` — if type is `scale` or `review`, set direction select to `"True"`, disable it, set `opacity: 0.4`, add tooltip explaining why. If type is `numeric`, re-enable. Scale criteria have inherent direction baked into the label names — "lower is better" is semantically nonsense for Excellent vs Poor. Note: `updateTypeHint` only fires on change event, not on initial render. This should be called for each criterion on form generation too — not fixed before deadline.

---

### Task 4 — UI Polish

The container was `max-width: 800px` on a 1920px screen, leaving ~35% unused on each side. The tab bar was a disconnected floating strip above the card. Font was system stack. Background was the purple gradient that appears in approximately 40% of all AI-generated tools.

Rewrote `styles.css` entirely — same class names, no JS changes. Key decisions:

- Font: Plus Jakarta Sans via Google Fonts. Loads via `@import` at top of CSS — no HTML change needed.
- Container: `max-width: 1100px`. Tab bar integrated flush with card top edge using `margin-bottom: -2px` and `z-index` layering.
- Background: `#f1f3f7` with two `radial-gradient` overlays at 20%/80% — barely visible, just enough depth.
- All colours in CSS variables. `--accent: #4f46e5` replaces the original `#667eea` everywhere. One variable change recolours the whole app.
- Setup step: `#step-setup .form-group:nth-child(-n+2)` targets the first two form groups and sets them side-by-side via `inline-block` + `calc(50% - 8px)`. Saves vertical space without HTML changes.
- Responsive: single column below 768px, side-by-side reverts, container padding reduces.
- Duplicated CSS removed — `ranking-list`, `breakdown-row`, and others were defined twice in the original file.

---

### What I Would Do Differently

**1. Scale criteria should have never had a direction input.** From the beginning, showing "Better When: Higher/Lower" for a scale criterion was wrong. The fix was an override in the backend. The correct design was to not show the selector at all for scale — or to set it, grey it out, and label it "Always Higher." This is now partially done (greyed out in Manual) but the selector is still rendered.

**2. The fetch issue would have been caught immediately with a one-line console.log.** `console.log(typeof fetch)` in `decisionLogic.js` at startup would have shown `undefined`. Instead I spent time on geo-restriction theories, curl commands, and API key rotations. The working reference project was the correct diagnostic tool — I should have compared the two files line by line on first failure, not after days of Groq fallbacks.

**3. Gemini's example-copying behaviour should have been anticipated.** Groq is permissive about instructions. Gemini is literal. Any example sentence in a prompt becomes the template Gemini writes to. This is a known difference. I should have tested with a bare prompt first.

**4. The CSS rewrite should have happened at Phase 1.** Adding styles piecemeal across phases produced duplicated rules, inconsistent spacing, and a file with no structure. Starting with CSS variables and a proper layout system at Phase 1 would have made every subsequent phase faster to style.

---

### Feature Status Update

| Feature | Status |
|---------|--------|
| Scale criteria false tie fix | ✅ |
| Scale direction always higher-is-better | ✅ |
| Gemini explanation working (gemini-2.5-flash) | ✅ |
| Review scoring Groq-only | ✅ |
| Form: whole-number options only | ✅ |
| Form: weight 1–10, one decimal max | ✅ |
| Form: direction locked for scale/review | ✅ (Manual tab only) |
| UI: 1100px container, Plus Jakarta Sans, CSS vars | ✅ (applied, pending screenshot verify) |
| Form: direction lock on initial render | ⚠️ Only fires on change, not on load |
| Form: direction lock — Smart Compare tab | ⚠️ Not yet applied |
| Memory tab loading/empty state overlap | ⚠️ Not fixed |

---

### Git Commit

```
Fix scale tie bug, Gemini explanation, form validation, UI polish pass
```

---

## Phase 2.7 — UI Polish, Bug Fixes, and Railway Deployment
### March 2, 2026

---

### Overview

This session covered the final UI pass before submission and the full deployment to Railway. It took longer than expected — mostly because of deployment. The UI work was straightforward. The deployment was not.

---

### Task 1 — Dark Mode Completion

Dark mode was partially working from the previous session. The remaining issues were hardcoded white backgrounds on search cards, product cards, the loading overlay, and the approval sections. Fixed by auditing every component against the `var(--bg)` and `var(--card)` CSS variables and replacing any hardcoded `#fff` or `background: white`.

Badge colors needed to be inverted for dark backgrounds — the light-mode badge colors (light pastel fills with dark text) became unreadable on dark cards. Fixed with `[data-theme="dark"]` overrides.

Dark mode toggle persists via `localStorage` with `dc-theme` as the key. OS preference detection added for first visit using `prefers-color-scheme: dark`.

No notable bugs here. Straightforward CSS variable work.

---

### Task 2 — Sticky Full-Width Navbar + Stepper

I wanted the tab bar to span the full viewport width — the body had `padding: 24px 16px` which was eating into the sides of the navbar, making it appear as a floating rectangle rather than a full-bleed bar. Fix was removing body padding and moving it to `.tab-content` instead.

The stepper (1→2→3→4 progress bar for Manual Compare, 1→5 for Smart Compare) was converted from an inline element to a sticky rounded rectangle card positioned below the navbar at `top: 68px`. Uses the same `var(--accent)` purple as the rest of the app. Connector lines between dots turn accent when steps are completed.

Manual Compare stepper: dots are clickable to navigate back to completed steps. Smart Compare stepper: dots are purely informational — API calls happen between steps, so jumping back would break state.

**Mistake:** Initial sticky stepper used `background: var(--bg)` with a bottom border — it looked like a grey band, not a card. Changed to `background: var(--card)` with a full border and `border-radius: var(--radius-lg)`. Much better.

---

### Task 3 — Memory Tab State Bug

The Memory tab was showing all three states simultaneously — "Loading your comparisons…", "No comparisons yet", and the actual memory cards. All visible at once.

**First hypothesis (mine):** The bug was in `deleteMemory()` and `clearAllMemory()` — they showed `memory-empty` without hiding `memory-loading` first. Applied a fix. No change.

**Second attempt:** Introduced `setMemoryState('loading' | 'empty' | 'list' | 'error')` — a centralized helper that hides all three divs first, then shows exactly one. Still no change.

**Actual root cause (found by Haiku with full file access):** There was no `.hidden { display: none; }` rule anywhere in `styles.css`. Every `classList.add('hidden')` call was silently doing nothing — the class was being added to the DOM but had no effect because CSS never defined what `.hidden` meant. The `memory-empty` div had `class="hidden"` in the HTML so it started hidden, but nothing was enforcing that hiding.

One line fix: `.hidden { display: none !important; }` added to `styles.css`.

**What I would do differently:** Check the CSS definition of utility classes before writing complex JS state management. I spent three debugging rounds on the JS when the problem was entirely in CSS. The correct first step was: open DevTools, inspect one of the divs, check if `.hidden` actually has any computed styles. It didn't.

The lesson for prompting: when I asked Claude to diagnose, I initially scoped the search to specific files. Claude found the fix only after I gave it unrestricted access to the full codebase. Should have done that first.

---

### Task 4 — Post-Smart-Compare Manual Tab Bug

After completing a Smart Compare, switching to the Manual Compare tab showed a blank screen — only the header was visible, no step content.

Root cause: `switchTab('manual')` showed the `#tab-manual` div but never activated any step inside it. The Smart Compare tab had a guard — `if (!hasActive) showStep('step-smart-search')` — that ran when switching to Smart. Manual had no equivalent guard. After Smart Compare completed, all manual steps had their `active` class stripped and nothing re-added it.

Fix: added the same guard to the `manual` case in `switchTab()` — if no step has `active`, call `showStep('step-setup')`.

---

### Task 5 — Direction Lock on Smart Compare

The Smart Compare priorities step had `handleTypeChange()` for when criteria type changed between Numeric / Scale / Review. Manual Compare already locked the direction select to "Higher is better" (disabled, greyed out) when type was Scale. Smart Compare did not — the direction dropdown stayed editable even when Scale was selected.

Fix: in `handleTypeChange()`, added a check for `typeSelect.value === 'scale'` — disables the select, sets value to `'higher'`, applies `opacity: 0.5; cursor: not-allowed`. Re-enables on `'numeric'`. `'review'` case unchanged (parent hidden entirely).

---

### Task 6 — Selection Icon Redesign

The criteria toggle buttons in "Set Your Priorities" were using 🟢 and ⬜ emoji. Replaced with a CSS-styled 18×18px checkbox div (`.crit-check`) — accent fill with white ✓ when active, grey outline when inactive. The search result cards already had the accent circle checkmark from a previous session — those were left unchanged.

Also removed the legend text line ("🟢 Selected — values differ… ⬜ Deselected… 🔘 Identical…") from the priorities step — the visual state of each card makes the legend redundant.

---

### Task 7 — Reliance Query and AI Suggestion Optimization

Two prompt engineering changes in `server.js`:

**`/api/refine-query`:** The old prompt was generic ("suggest queries for an Indian e-commerce site"). Replaced with Reliance Digital-specific guidance — short Brand + Product Type + Key Spec format with concrete examples ("Samsung 65 inch 4K TV"). Avoids vague words like "best", "good", "latest" which return poor results on Reliance's search.

**`buildIdealSuggestionPrompt()`:** The old prompt gave generic consumer advisor instructions. New version is India-specific with concrete rules: Price ideal = lowest shown minus 5-10%, Rating ideal = 4.5, Battery/Capacity = highest shown, Weight = lowest shown. Also added strong instruction that ideal must always be a plain number — the old prompt was getting values like "30 hours" or "5000 mAh" instead of 30 and 5000.

---

### Task 8 — Railway Deployment

This took most of the session. Summary of what went wrong in order:

**Problem 1 — Railpack couldn't detect the app.** Root `package.json` didn't exist — Railpack saw `backend/`, `frontend/`, `docs/` folders and no entry point. Set root directory to `backend/` in Railway settings.

**Problem 2 — Frontend path wrong.** With root set to `backend/`, Railway only deployed the `backend/` folder. `express.static('../frontend')` resolved to `/frontend` which didn't exist. Added a root `package.json` with `"start": "node backend/server.js"` to deploy from project root instead.

**Problem 3 — `Cannot find module 'dotenv'`.** The root `package.json` had no `dependencies` — Railway ran `npm install` at root and found nothing. `backend/node_modules` was never populated. Fixed by adding an `install` script: `"install": "cd backend && npm install"`.

**Problem 4 — `secret FIREBASE_API_KEY: not found`.** Railpack was trying to mount environment variables as build secrets during the Docker build step. Secrets aren't available at build time in Railway's sandbox. Added `railway.toml` to switch from Railpack to Nixpacks builder, which only injects env vars at runtime.

**Problem 5 — `ReferenceError: File is not defined`, Node v18.** Nixpacks provisioned Node 18 by default. `node-fetch` v3 requires Node 20 — `File` is a global that doesn't exist in Node 18. Tried `[build.environment] NODE_VERSION = "20"` in `railway.toml` — ignored. Tried `"engines": { "node": ">=20.0.0" }` in `package.json` — ignored. Fixed by adding `NIXPACKS_NODE_VERSION = 20` as a Railway service variable — this is the actual variable Nixpacks reads.

**Problem 6 — Groq 401.** Trailing space in the `GROQ_API_KEY` value in Railway's variables panel. Re-pasted carefully.

**What I would do differently:** Write a `Dockerfile` before touching Railway at all. Eight lines would have fixed every single one of these problems:

```dockerfile
FROM node:20
WORKDIR /app
COPY backend/ ./backend/
COPY frontend/ ./frontend/
RUN cd backend && npm install
CMD ["node", "backend/server.js"]
```

Node version pinned. Path structure explicit. No platform guessing. Estimated time with Dockerfile: 5 minutes. Actual time without: 2+ hours.

The prompting lesson: before starting any unfamiliar phase, ask "what should I know before doing X" and "what could go wrong with X given my setup" rather than jumping straight to execution. I asked "how do I deploy" when I should have asked "what's the right way to deploy this for the first time."

---

### Final State

App is live at `https://vonnue-decision-maker-production.up.railway.app`

Every push to `main` on GitHub triggers an automatic Railway redeploy.

Firebase: persistent Firestore memory ✅  
Gemini: explanations working ✅  
Groq: query refinement, spec scoring, explanations ✅  
Reliance scraping: 12–20 products per search ✅  

---

### Feature Status Update

| Feature | Status |
|---------|--------|
| Dark mode — full coverage including cards, badges, overlays | ✅ |
| Full-width sticky navbar | ✅ |
| Sticky stepper — Manual Compare (1→2→3→4, clickable back) | ✅ |
| Sticky stepper — Smart Compare (1→5, display only) | ✅ |
| Memory tab state bug (.hidden CSS fix) | ✅ |
| Post-Smart-Compare manual tab blank bug | ✅ |
| Direction lock — Smart Compare Scale criteria | ✅ |
| Criteria toggle — CSS checkbox replacing emoji | ✅ |
| Reliance-optimized query refinement prompt | ✅ |
| Improved AI ideal suggestion prompt | ✅ |
| Railway deployment — live public URL | ✅ |
| Ideal column for review criteria in details table | ⚠️ Shows 10 instead of text (carried over) |

---

### Git Commit

```
Feat: Final UI touchup — dark mode, sticky navbar, stepper nav, rounded cards, memory state fix, direction lock Smart Compare, Reliance query optimization, AI suggestion improvement, Railway deployment
```

---

## What I Would Do Differently

1. Start documentation from Day 1, not catch up later
2. Write test cases before writing the algorithm (test-driven approach)
3. Draw an architecture diagram before coding
4. Commit after every small working change, not in large batches
5. Set up `.gitignore` before the first commit
6. Research API rate limits before building features that depend on free-tier APIs
