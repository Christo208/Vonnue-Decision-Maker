# Decision Companion System

**Live:** https://vonnue-decision-maker-production.up.railway.app

A web-based decision support tool that helps users evaluate multiple options against weighted criteria and arrive at a ranked, explainable recommendation. Built as a take-home assignment for Vonnue — deadline March 2, 2026.

---

## Understanding the Problem

The assignment asked for a "Decision Companion System" — a system that helps a user make better decisions by evaluating options against criteria.

The phrase that shaped everything: *"Your logic should be explainable (not a black box)."*

That ruled out delegating the decision to an AI model. It also ruled out a static comparison table. What it demanded was a system where the user could see exactly why one option won — what weighted criteria penalized each option, by how much, and in what proportion.

A second constraint — *"The system should not be entirely AI dependent"* — meant the core scoring had to be deterministic. I could use AI for supporting roles (explanation, review scoring, query refinement) but the ranking output had to be reproducible from the inputs alone, without an API call.

My interpretation: build a transparent, weighted penalty scoring engine. Every number in the output traces back directly to a number the user entered. AI assists at the edges. The algorithm is mine.

---

## Assumptions Made

1. **Users may not have technical backgrounds.** Labels like "normalized penalty" or "weighted distance" would be meaningless. The UI and explanations are written in plain English.

2. **Criteria importance is relative, not absolute.** A user saying "price is more important than RAM" does not mean price is twice as important — it means it matters more in relative terms. The system uses a 1–10 importance scale and normalizes it internally.

3. **"Ideal" values are aspirational, not filtering rules.** If no product meets the ideal price, the system does not eliminate all products — it picks the closest one and shows the gap. The system always produces a recommendation.

4. **Not all criteria are numeric.** A user comparing job candidates needs to express "communication quality" — a number alone cannot capture this. The system supports three input types: numeric, scale (Excellent → Poor), and free-text review (AI-scored).

5. **Product data should be fetchable, not manually entered.** For real-world decisions, requiring users to look up and type 40 specs per product is impractical. Phase 2 automates this via Reliance Digital's search and product detail APIs.

6. **No login system needed.** Decision Memory uses Firebase Firestore keyed by device session. Sufficient for the use case and buildable within the deadline.

---

## How the Solution Is Structured

The project has three layers:

### Backend — `backend/`
Node.js + Express server. Handles:
- `/api/preprocess` — normalizes inputs, runs AI review scoring (Groq → Gemini fallback)
- `/api/calculate` — runs the penalty scoring algorithm, generates AI explanation
- `/api/search` — calls Reliance Digital's native catalog search API
- `/api/scrape` — fetches full product specs from Reliance Digital product detail API
- `/api/refine-query` — uses Groq to rewrite the user's search query into a form that gets better results from Reliance Digital's search engine, which returns poor results for vague or conversational queries
- `/api/suggest-ideals` — uses Groq to suggest ideal values based on scraped product data
- `/api/memory/*` — Firebase Firestore CRUD for saved comparisons

Core decision logic lives in `backend/decisionLogic.js`. This file has no AI calls — it is pure deterministic math.

### Frontend — `frontend/`
Plain HTML, CSS, and JavaScript. No framework. Three tabs:

- **Manual Compare** — 5-step wizard. User defines criteria, enters product values, sets ideals, reviews AI-scored criteria at an approval stage, then runs the decision engine.
- **Smart Compare** — User types a product name. System searches Reliance Digital, scrapes full specs, presents a criteria toggle table (identical columns auto-hidden), user sets priorities, system runs the decision engine.
- **Decision Memory** — Saved comparisons. Replay any past result. Re-run the animation. Rename inline.

### Visualizer — `frontend/visualizer_prototype.html`
A standalone Pixi.js WebGL animation that makes the algorithm visible. Characters representing each option stand on platforms. As each criterion is scored, a fireball sized to the penalty drops and sinks the platform. The algorithm plays out visually — the user watches penalties accumulate rather than reading a table.

---

## Design Decisions and Trade-offs

### Decision Algorithm — Weighted Penalty Scoring

I chose weighted penalty scoring (distance from ideal point method) over alternatives for one reason: it is explainable in plain English.

Every product starts at 0 penalty. For each criterion, a penalty is calculated based on how far the product's value is from the user's ideal:

- **"Higher is better" criteria** (RAM, Battery): `penalty = max(0, ideal − actual)` — no penalty if the product exceeds the ideal
- **"Lower is better" criteria** (Price, Weight): `penalty = max(0, actual − ideal)` — no penalty if the product is below the ideal

Values are min-max normalized to a 0–100 scale before scoring so that price (₹30,000) does not dominate RAM (16 GB) purely by magnitude.

Penalties are multiplied by normalized criterion weights. The product with the lowest total weighted penalty wins.

**Trade-off:** TOPSIS and AHP are more academically rigorous. They were rejected because they are harder to explain to a non-technical user. The chosen algorithm can be described in two sentences.

### Three Input Types

Most decision support tools only accept numbers. The Hybrid Input Engine (Phase 1.5) adds:

- **Scale** — dropdown mapping (Excellent=10, Very Good=9, ..., Poor=4). Deterministic, no AI. Covers most qualitative criteria.
- **Review** — free text (e.g., "The battery dies after 4 hours of use"). Groq converts this to a 1–10 score with a confidence level.

The critical design rule: AI only touches the *conversion from text to number*. Once a review becomes a score, it enters the same deterministic algorithm as everything else. The user can override any AI score at the Approval Stage (Step 4.5) before the calculation runs.

**Trade-off:** This adds complexity to the UI. Justified because the alternative — forcing users to manually translate "The battery dies after 4 hours" into a number — introduces more user error than AI conversion does.

### Approval Stage

When the user submits review-type criteria, they see a table showing: their original text, the AI's score (1–10), the confidence level, and the source (Groq or Gemini). They can override any score using the scale dropdown before proceeding.

This design keeps the user in control. The AI assists; the human approves.

**Trade-off:** Adds a step to the flow. Worth it — it is the mechanism that prevents the system from being a black box.

### Reliance Digital Native API Over HTML Scraping

Phase 2 required product data from an e-commerce site. Options considered:

| Option | Decision | Reason |
|--------|----------|--------|
| Amazon.in | Rejected | Aggressive bot detection, CAPTCHA walls, legal exposure |
| Flipkart | Rejected | Heavy client-side JS rendering requires headless browser (Puppeteer) |
| Croma | Attempted then dropped | Spec tables are JS-rendered; static Cheerio scraping returns empty tables |
| SerpAPI | Replaced | Free tier was unusable; Reliance native API made it unnecessary |
| Reliance Digital | Chosen | Native internal APIs discovered via browser DevTools network inspection |

The Reliance discovery: watching DevTools Network tab during a real search revealed two undocumented internal API endpoints — a catalog search endpoint and a product detail endpoint — both returning clean structured JSON. No HTML parsing, no fragile selectors, no external service required.

**Trade-off:** This only works for Reliance Digital. Expanding to other retailers requires rebuilding the scraper layer per site. The scraper architecture is modular (`backend/scrapers/`) specifically to make this manageable.

### Firebase Firestore for Decision Memory

Compared to localStorage: persists across browser wipes, survives tab closes, accessible on any device with the same session. The system degrades gracefully if Firebase is unavailable — an in-memory fallback stores comparisons for the session without surfacing an error to the user.

**Trade-off:** Requires Firebase credentials in `.env`. Local runs without credentials still work — they just do not persist across refreshes.

### AI Explanation — Groq Primary, Gemini Fallback

Groq (Llama 3.3-70B) is used as the primary explanation generator. Gemini 2.5-flash is the fallback. A hardcoded template explanation is the final fallback — the app always produces an explanation even with no API keys configured.

Review scoring (Phase 1.5) uses Groq only. Gemini is reserved for explanation generation. This separation was necessary because firing N simultaneous Gemini calls for review scoring blew the free-tier RPM limit before the explanation call could go through.

### Pixi.js for the Visualizer

CSS animations were considered. Pixi.js was chosen for two reasons: WebGL rendering enables real glow effects (the fireball visuals require bloom that CSS cannot produce), and `AnimatedSprite` plays PNG frame sequences natively. The fireball assets are spritesheet-based — Pixi handles them without a separate animation library.

**Trade-off:** Pixi.js adds ~1MB to the visualizer page. Acceptable for a standalone page opened only when the user explicitly requests the animation.

---

## Edge Cases Considered

**Ideal outside product range:** If the user enters an ideal price of ₹10,000 when all products cost ₹25,000–₹35,000, the normalized ideal is negative. Without clamping, the penalty formula inverts — cheaper products get penalized more than expensive ones. Fix: clamp normalized ideal to [0, 100].

**Identical products on one criterion:** If all products have the same RAM, `max − min = 0` and normalization produces `0/0 = NaN`. NaN propagates through the weighted sum and corrupts the final score. Fix: detect when all values are identical for a criterion. If so, set penalty = 0 for all products — they are equally good on this dimension.

**Ties:** Floating point arithmetic means scores of 15.300000 and 15.299999 may represent the same result. Using `==` for tie detection would miss these. The tie threshold is `1.0` — scores within 1 weighted penalty point of each other are shown as a tie.

**AI failure:** Groq or Gemini may be unavailable (rate limit, no API key, network error). For review scoring: fallback chain is Groq → Gemini → `null` with a flag. The Approval Stage then shows the null score and lets the user enter a value manually. For explanation: Groq → Gemini → template. The template always renders — the system never produces a blank explanation.

**Scale criteria direction:** Scale criteria (Excellent → Poor) always have "higher is better" semantics baked in. If a user accidentally selects "lower is better" for a scale criterion, the direction would be wrong. Fix: the server forcibly overrides direction to "higher" for all scale-type criteria at the `/api/preprocess` route.

**Scraped specs with inconsistent keys:** Reliance Digital's product detail API returns different field names for different categories. The scraper does not assume a fixed field list — it extracts the full union of all fields returned. Criteria with identical values across all products are auto-deselected in the Smart Compare toggle UI to reduce noise.

**Tab state after comparison:** After a Smart Compare completes, the `showAmazonStep()` function strips the `active` class from all Smart Compare steps. If the user then switches away and back, no step is active — blank screen. Fix: `switchTab()` checks if any step has `active` when switching to Smart. If not, it forces `step-smart-search` active.

---

## How to Run the Project

### Prerequisites
- Node.js 20 or later
- A `.env` file in `backend/` (see below)

### Environment Variables (`backend/.env`)
```
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

All API keys are optional. Without them:
- Groq/Gemini missing → explanation uses template fallback
- Firebase missing → Decision Memory works in-memory only (no persistence)

### Install and Run
```bash
cd backend
npm install
node server.js
```

Then open `http://localhost:3000` in your browser.

### Live Version
The app is deployed at:
```
https://vonnue-decision-maker-production.up.railway.app
```
No setup needed to evaluate the live version.

---

## What I Would Improve With More Time

**1. Phase 3 — Customer Review Analysis**

The original three-phase roadmap included review analysis: scraping customer reviews from multiple sources and using AI to extract sentiment scores per criterion. This was the most ambitious phase and was not attempted before the deadline. It would complete the system's data pipeline — currently the "Review" input type relies on the user writing their own assessment. Phase 3 would fetch real user opinions automatically.

**2. Multi-site scraping**

The Smart Compare feature only works with Reliance Digital. The scraper module is designed to be pluggable — each scraper is a standalone module in `backend/scrapers/`. Adding Flipkart or Croma (via Puppeteer for JS-rendered pages) would widen the product universe significantly.

**3. Direction lock for initial render**

The scale criteria direction lock (disabling the "Higher/Lower is better" dropdown when type is Scale) fires on `change` events but not on initial form render. Criteria that default to Scale show an editable direction select until the user interacts with them. This needs to be called once on form generation, not only on change.

**4. Review criteria ideal in comparison table**

The comparison details table shows `10` for review-type criteria in the Ideal column. The actual ideal text (e.g., "Excellent camera quality") gets overwritten during preprocessing. Fix: pass the raw ideals separately into the rendering function before coercion. Identified but not implemented before deadline.

**5. Proper test suite**

All testing was manual — 10 test cases run through the web interface. An automated test suite for `decisionLogic.js` would catch regressions immediately. The algorithm is a pure function with no side effects — it is straightforward to unit test.

**6. Dockerfile from the start**

Railway deployment required resolving six sequential problems (wrong root directory, missing dependencies, Firebase secret mounting at build time, Node version mismatch, Groq key whitespace). A Dockerfile written before deployment would have fixed all of them in eight lines. It was written afterward.

**7. Caching scraped results**

Repeated searches for the same product re-scrape Reliance Digital. A lightweight cache (Redis or even a Firestore collection) would reduce latency and avoid hitting the API repeatedly for the same data. The architecture decision was deferred to keep Phase 2 simpler.

---

## Tech Stack Summary

| Layer | Technology | Reason |
|-------|-----------|--------|
| Backend | Node.js + Express | Phase 2 scraping compatibility, single-language stack |
| Frontend | HTML + CSS + JavaScript | No framework overhead, sufficient for requirements |
| Visualizer | Pixi.js (WebGL) | Fireball glow effects, spritesheet animation |
| Decision logic | Custom algorithm (`decisionLogic.js`) | Deterministic, explainable, no AI dependency |
| Review scoring | Groq (Llama 3.3-70B) | Fast, high rate limit on free tier |
| Explanation | Groq → Gemini 2.5-flash → template | Layered fallback — always produces output |
| Product search | Reliance Digital native catalog API | No third-party service, returns clean JSON |
| Memory | Firebase Firestore + in-memory fallback | Persistent, graceful degradation |
| Deployment | Railway | Auto-deploy on `git push`, free tier sufficient |

---

## AI Tool Usage

AI was used throughout this project. The boundary I committed to on Day 1:

- **Core scoring algorithm** — no AI. Deterministic weighted penalty math written by me.
- **Review scoring** — AI converts free text to a number. The user sees and can override every AI score before calculation.
- **Explanation generation** — AI writes the explanation paragraph. The explanation does not affect the ranking.
- **Query refinement** — AI suggests cleaner search terms. The user confirms before any search runs.
- **Ideal value suggestions** — AI suggests starting values based on scraped data. The user adjusts before calculation.

Tools used: Claude (architecture, algorithm design, debugging, documentation), ChatGPT (summarizing long responses), VS Code Copilot Agent with Claude Haiku (file edits in agentic mode), Gemini via Antigravity IDE (planning mode for multi-file tasks).

A full log of every AI prompt used is in `RESEARCH_LOG.md`.
