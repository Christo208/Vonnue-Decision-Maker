# BUILD_PROCESS.md
## Decision Companion System — Build Journal

---

## How I Started

**Day 1 — February 14, 2026**

Received the assignment email from Vonue. First reaction was confusion — this was nothing like a typical coding task. No specific algorithm to implement, no clear "right answer."

My first step was to paste the entire email into Claude and ask it to elaborate the problem statement. I needed someone to break down what was actually being asked of me before I could write a single line of code.

Key realization from that session:
- The system had to be **generic** (not hard-coded for one scenario)
- The **core decision logic must be mine** — AI cannot make the decision
- Documentation was as important as the code itself

I had never built an open-ended system before. I was overthinking it. Claude advised: "Start with something that barely works."

---

## Initial Ideas — February 15, 2026

Before writing any code, I sketched out a 3-phase vision:

**Phase 1:** User manually enters products and features → System calculates decision using weighted scoring

**Phase 2:** System auto-fetches product data from internet via web scraping → User only enters product name

**Phase 3:** Add customer review analysis to assist or override the scoring decision

This phased approach helped me avoid scope creep. I committed to completing Phase 1 fully before thinking about Phase 2 or 3.

**Technology decision:**
- Considered React → Rejected. Too much learning curve for this timeline.
- Considered mobile app → Rejected. Overkill.
- Chose: Plain HTML + CSS + JavaScript frontend, Node.js + Express backend
- Why Node.js: Prepares for Phase 2 (web scraping libraries available), simple setup, already installed

---

## First Algorithm — February 15, 2026

My first algorithm idea: **Absolute Distance from Ideal Point**

Logic:
- User enters ideal values for each feature
- System calculates how far each product is from that ideal
- Product with smallest total distance wins

This was my own idea. Claude confirmed it is a real technique called "distance from ideal point method."

**First version problems (caught in code review):**

1. No weights — all features treated equally
2. No "higher vs lower is better" distinction
3. No normalization — price (in thousands) dominated RAM (in single digits)
4. String stored as string, not float

These were not AI-generated solutions. Claude pointed out the problems; I fixed them myself.

---

## Improving the Algorithm — February 16, 2026 (Morning)

**Fix 1: Added weights**
- Asked user to rate importance of each feature on 1–5 scale
- Auto-normalized weights to sum to 1.0
- More intuitive than asking for percentages directly

**Fix 2: Normalization**
- Found min and max for each feature across all products
- Converted all values to 0–100 scale
- Critical: also normalized the ideal values using the same formula
- Bug I made here: forgot to normalize ideals → was comparing 0-100 scale to raw values → completely wrong results

This was the first serious bug I caught. Took about 45 minutes to fix correctly.

**Fix 3: Division by zero handling**
- If all products have the same value for a feature, max = min → division by zero
- Fix: set normalized value to 50.0 (neutral) in that case

---

## Adding Direction Logic — February 16, 2026 (Afternoon)

The "higher vs lower is better" problem was the most important fix.

Without it:
- A laptop priced at ₹45,000 when ideal is ₹50,000 would be penalized
- But it's actually CHEAPER than ideal — that's good!

The logic I implemented:
- **Higher is better** (RAM, Battery, Performance): penalty = max(0, ideal − actual)
  - No penalty if actual exceeds ideal
- **Lower is better** (Price, Weight): penalty = max(0, actual − ideal)
  - No penalty if actual is below ideal

**Bug found during implementation:**
I wrote: `d[i][y] = abs(d[i][y] - norm_req_list[x]) + penalty`

This doubled the penalty — abs() already gave the distance, then I added the penalty on top. All scores were 2x what they should be.

Fix: Remove abs(), just store penalty directly: `d[i][y] = penalty`

This mistake is documented because it shows real development process. Claude caught it in code review.

---

## Tie Detection — February 16, 2026 (Evening)

Added tie detection with float tolerance.

Initial approach: `if score == mvp_score`

Problem: Floating point comparison with `==` can fail due to precision errors (e.g., 15.3 stored as 15.299999999...)

Fix: `if abs(score - mvp_score) < 0.001`

This was option 2 of 3 presented. Chosen because it's simple and intuitive.

---

## Website Setup — February 16, 2026 (Evening)

**Decision: Convert Python → JavaScript**

Options considered:
- Keep Python, call it from Node.js → Rejected (two languages, complex setup)
- Use Python Flask → Rejected (chose Node.js for Phase 2 compatibility)
- Convert to JavaScript → Chosen

Conversion was straightforward. Same variable names kept (`d`, `f_list`, `rate_list`, `high_or_low`, `norm_req_list`, `agg_sum`). Python dictionaries became JavaScript objects. Python lists became JavaScript arrays.

**Multi-step form design:**
- Step 1: Enter number of products and features
- Step 2: Define criteria (name, importance, direction)
- Step 3: Enter product values
- Step 4: Enter ideal values
- Step 5: View results with ranking and breakdown

**Git confusion resolved:**
Was worried that git commits would upload files to GitHub. Clarified that git is local version control only. Nothing is uploaded unless explicitly pushed. Commits stay in `.git` folder on local machine.

---

## Testing — February 17, 2026

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
| 9 | Investment strategy | ✅ Correct (initially thought it failed — manual recalculation confirmed system was right, my prediction was wrong) |
| 10 | Tech stack selection | ✅ Correct |

Test 9 was the most educational. I predicted Gold would win. System chose Stocks. Manual verification showed system was correct — Stocks had penalties on only 1 criterion while Gold had penalties on 2. My intuition had been wrong.

---

## Alternative Approaches Considered and Rejected

| Approach | Reason Rejected |
|----------|-----------------|
| React framework | Learning curve too steep for this timeline |
| TOPSIS / AHP algorithms | Too complex to explain; weighted penalty is sufficient and explainable |
| AI makes the decision | Violates assignment requirement ("not AI dependent") |
| Hard-coded scenarios | Violates assignment requirement ("not hard-coded") |
| Range-based ideal values | Added complexity; deferred to future enhancement |
| Duplicate product merging | Edge case; simple tie detection handles it adequately |
| Mobile app | Overkill, weeks to build properly |

---

## What Changed During Development

| Original Plan | Final Implementation | Reason |
|---------------|----------------------|--------|
| CLI tool only | Web interface | More professional, easier to demonstrate |
| Simple absolute distance | Direction-aware penalty scoring | Handles "higher vs lower is better" correctly |
| Single output (winner only) | Ranking + detailed breakdown per product | More explainable, meets assignment requirement |
| Manual weight percentages | Importance rating (1–5), auto-normalized | More intuitive for users |
| Exact float equality for ties | Epsilon tolerance (< 0.001) | Floating point precision issues |

---

## Honest Mistakes and Corrections

**Mistake 1: Did not normalize ideal values**
- Impact: Completely wrong results (comparing 0–100 scale to raw numbers)
- How found: Claude code review
- Fix: Added normalization for req_list using same min/max formula

**Mistake 2: Double penalty calculation**
- Impact: All scores were 2x too high
- How found: Claude pointed out abs() + penalty was redundant
- Fix: Removed abs(), stored penalty directly

**Mistake 3: Assumed Test Case 9 failed**
- Impact: None — system was correct
- How found: Manual recalculation
- Lesson: Always verify before concluding system is wrong

**Mistake 4: Thought git commits upload to GitHub**
- Impact: Delayed first commit
- How found: Asked Claude for clarification
- Fix: Understood git is local; GitHub is optional and separate

---

## Current State

Phase 1 — Complete ✅
- Generic decision system working
- Handles any number of products and features
- Direction-aware penalty scoring
- Normalization for fair comparison
- Weighted ranking
- Tie detection
- Web interface with multi-step form
- Detailed results breakdown

Phase 2 — Planned (web scraping)
Phase 3 — Planned (review analysis)

---

## What I Would Do Differently

1. Start documentation from Day 1 (not catch up later)
2. Write test cases before writing algorithm (test-driven approach)
3. Draw architecture diagram before coding
4. Make git commits after every small working change, not in large batches

---

*This document reflects the honest, real process of building this system — including confusion, mistakes, and corrections.*
