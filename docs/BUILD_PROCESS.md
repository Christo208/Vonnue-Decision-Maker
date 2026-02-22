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

## What I Would Do Differently

1. Start documentation from Day 1, not catch up later
2. Write test cases before writing the algorithm (test-driven approach)
3. Draw an architecture diagram before coding
4. Commit after every small working change, not in large batches
5. Set up `.gitignore` before the first commit
6. Research API rate limits before building features that depend on free-tier APIs
