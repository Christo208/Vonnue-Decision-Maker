// decisionLogic.js
// Decision scoring is deterministic. Explanations are AI-assisted with
// robust template fallbacks and four user-facing narrative styles.
// Phase 1.5: Adds subjective/qualitative criteria support.

require("dotenv").config();

// ─────────────────────────────────────────────────────────────────────────────
// SCALE MAP  (100% manual logic — no AI involved)
// ─────────────────────────────────────────────────────────────────────────────
const SCALE_MAP = {
  "Excellent": 10,
  "Very Good": 9,
  "Good": 8,
  "Above Average": 7,
  "Average": 6,
  "Below Average": 5,
  "Poor": 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE DECISION ALGORITHM (unchanged from Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
function calculateDecision(products_data, f_list, rate_list, req_list, high_or_low) {
  const total = rate_list.reduce((sum, r) => sum + r, 0);
  const weights = rate_list.map((r) => r / total);

  const d = JSON.parse(JSON.stringify(products_data));

  const min_max = {};
  for (const feature of f_list) {
    const values = Object.keys(d).map((p) => d[p][feature]);
    min_max[feature] = { min: Math.min(...values), max: Math.max(...values) };
  }

  // Track which features are identical across all products — they carry no info
  const identicalFeatures = new Set();

  for (const feature of f_list) {
    const { min: min_v, max: max_v } = min_max[feature];
    for (const p in d) {
      if (max_v === min_v) {
        // All products identical on this feature — mark it, normalize to 50
        identicalFeatures.add(feature);
        d[p][feature] = 50.0;
      } else {
        d[p][feature] = ((d[p][feature] - min_v) / (max_v - min_v)) * 100;
      }
    }
  }

  const norm_req_list = [];
  for (let i = 0; i < f_list.length; i++) {
    const { min: min_v, max: max_v } = min_max[f_list[i]];
    if (max_v === min_v) {
      // Identical feature: set ideal = 50 so penalty is always 0
      norm_req_list.push(50.0);
    } else {
      // FIX 1: Clamp normalized ideal to [0, 100] so out-of-range ideals
      // don't produce runaway penalties that make all products look equally bad
      const raw = ((req_list[i] - min_v) / (max_v - min_v)) * 100;
      norm_req_list.push(Math.min(100, Math.max(0, raw)));
    }
  }

  // Build named map of normalized ideal values
  const normedIdeals = {};
  for (let i = 0; i < f_list.length; i++) {
    normedIdeals[f_list[i]] = parseFloat(norm_req_list[i].toFixed(4));
  }

  // Snapshot normalized values before penalty calculation overwrites d
  const normedValues = {};
  for (const p in d) {
    normedValues[p] = {};
    for (const f of f_list) {
      normedValues[p][f] = parseFloat(d[p][f].toFixed(4));
    }
  }

  const agg_sum = {};
  const detailed_breakdown = {};

  for (const i in d) {
    let tsum = 0;
    detailed_breakdown[i] = {};

    for (let x = 0; x < f_list.length; x++) {
      const y = f_list[x];
      let penalty;

      // FIX 2: Identical features (all products same value) contribute zero
      // penalty — they're uninformative and shouldn't influence the result
      if (identicalFeatures.has(y)) {
        penalty = 0;
      } else if (high_or_low[x] === "True") {
        penalty = Math.max(0, norm_req_list[x] - d[i][y]);
      } else {
        penalty = Math.max(0, d[i][y] - norm_req_list[x]);
      }

      d[i][y] = penalty;
      const weighted_penalty = penalty * weights[x];
      tsum += weighted_penalty;

      detailed_breakdown[i][y] = {
        penalty: parseFloat(penalty.toFixed(4)),
        weight: parseFloat(weights[x].toFixed(4)),
        weighted_penalty: parseFloat(weighted_penalty.toFixed(4)),
        direction: high_or_low[x] === "True" ? "higher" : "lower",
      };
    }
    agg_sum[i] = tsum;
  }

  const mvp_score = Math.min(...Object.values(agg_sum));
  const tie = [];

  const ranking = Object.entries(agg_sum)
    .sort((a, b) => a[1] - b[1])
    .map(([product, score], index) => {
      // FIX 3: Threshold of 1.0 (on 0–100 scale) catches near-identical products
      // that floating point normalization would never hit with 0.001
      if (Math.abs(score - mvp_score) < 1.0) tie.push(product);
      return { rank: index + 1, product, score: parseFloat(score.toFixed(4)) };
    });

  return {
    winner: tie.length === 1 ? tie[0] : null,
    tie,
    ranking,
    agg_sum,
    detailed_breakdown,
    weights,
    features: f_list,
    directions: high_or_low,
    normed: normedValues,
    normedIdeals,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1.5 — AI SCORE EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the shared prompt for AI score extraction.
 * AI is a TRANSLATOR only — outputs a score, not a decision.
 */
function buildScorePrompt(text, featureName, idealDescription) {
  return `You are a feature scorer. Score how well a review text matches an ideal target for a specific feature.

Feature: "${featureName}"
Ideal Target: "${idealDescription}"
Review Text: "${text}"

Scoring guide (use the FULL 1-10 range, not just extremes):
- 10: Review text is a near-perfect match for the ideal target
- 8-9: Clearly matches the ideal with minor differences
- 6-7: Partial match, mostly relevant
- 4-5: Somewhat related but noticeably different from ideal
- 2-3: Opposite of ideal, or mostly irrelevant text
- 1: Completely off-topic (e.g. review is about a different subject entirely)

Examples:
- Ideal: "relaxing and quiet", Review: "Very peaceful atmosphere" → {"score": 9, "confidence": "high"}
- Ideal: "relaxing and quiet", Review: "Somewhat calm but occasionally noisy" → {"score": 5, "confidence": "medium"}
- Ideal: "relaxing and quiet", Review: "Loud party scene every night" → {"score": 2, "confidence": "high"}
- Ideal: "fast performance", Review: "The weather is nice" → {"score": 1, "confidence": "low"}

Output ONLY a raw JSON object. No markdown, no backticks, no explanation.
Required format: {"score": 7, "confidence": "high"}`;
}

/**
 * Parses and validates the AI's JSON response.
 * Returns { score, confidence } or throws if invalid.
 */
function parseScoreResponse(text) {
  try {
    // Regex to find the JSON block {...} in case the LLM adds chatter
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in response");

    const cleaned = match[0].trim();
    const parsed = JSON.parse(cleaned);

    const score = parseInt(parsed.score, 10);
    const validConfidences = ["high", "medium", "low"];

    if (isNaN(score) || score < 1 || score > 10) throw new Error("Score out of range");
    if (!validConfidences.includes(parsed.confidence)) throw new Error("Invalid confidence value");

    return { score, confidence: parsed.confidence };
  } catch (err) {
    console.error("Parse error raw text:", text);
    throw new Error(`JSON Parse failed: ${err.message}`);
  }
}

/**
 * Calls Gemini first, then Groq, then returns AI_FAIL.
 * API order: Gemini → Groq → Fallback (per approved design decision #4).
 */
async function extractScoreFromText(text, featureName, idealDescription) {
  const prompt = buildScorePrompt(text, featureName, idealDescription);

  // ── Groq only — Gemini is reserved for generateExplanation ─────────────────
  // NOTE: Gemini free tier RPM limit is blown when N products are scored in
  // rapid succession. Groq handles scoring; Gemini gets a clean window for
  // the explanation where its quality difference is actually noticeable.
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("No Groq key");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 150,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Groq error: ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty Groq response");

    const { score, confidence } = parseScoreResponse(raw);
    return { score, confidence, source: "groq" };
  } catch (groqErr) {
    console.log("Groq score extraction failed:", groqErr.message);
  }

  return { score: null, confidence: null, source: "AI_FAIL" };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1.5 — PREPROCESSOR
// Converts scale strings and review texts → numbers.
// The core calculateDecision ALWAYS receives pure numbers.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * products_data : { ProductName: { FeatureName: rawValue, ... }, ... }
 * feature_types : ["numeric"|"scale"|"review", ...]
 * f_list        : feature name array
 * ideals        : raw ideal values (numbers, scale strings, or description strings)
 *
 * Returns:
 * {
 *   scored_data  : products_data with all values converted to numbers,
 *   scored_ideals: ideals array with all values converted to numbers,
 *   metadata     : { ProductName: { FeatureName: { source, confidence } } },
 *   ai_failures  : [ { product, feature } ]  — slots where AI failed
 * }
 */
async function preprocessInputs(products_data, feature_types, f_list, ideals) {
  const scored_data = JSON.parse(JSON.stringify(products_data));
  const scored_ideals = [...ideals];
  const metadata = {};
  const ai_failures = [];

  for (const product of Object.keys(scored_data)) {
    metadata[product] = {};
  }

  for (let fi = 0; fi < f_list.length; fi++) {
    const feature = f_list[fi];
    const type = feature_types[fi];

    // ── Numeric: pass through ─────────────────────────────────────────────────
    if (type === "numeric") {
      for (const product of Object.keys(scored_data)) {
        metadata[product][feature] = { source: "numeric", confidence: null };
      }
      // ideal is already a number — no change needed
      continue;
    }

    // ── Scale: map string → number ────────────────────────────────────────────
    if (type === "scale") {
      for (const product of Object.keys(scored_data)) {
        const rawVal = scored_data[product][feature];
        scored_data[product][feature] = SCALE_MAP[rawVal] ?? 5; // default Average if unknown
        metadata[product][feature] = { source: "scale", confidence: null };
      }
      // Map ideal scale string too
      // Guard: frontend may send a number or numeric string instead of a label string
      const rawIdeal = ideals[fi];
      scored_ideals[fi] = (typeof rawIdeal === 'string' && SCALE_MAP[rawIdeal] !== undefined)
        ? SCALE_MAP[rawIdeal]
        : (parseFloat(rawIdeal) || 5);
      continue;
    }

    // ── Review: call AI for all products ──────────────────────────
    if (type === "review") {
      const idealDescription = String(ideals[fi]);
      const products = Object.keys(scored_data);

      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const results = [];

      for (const product of products) {
        const res = await extractScoreFromText(
          String(scored_data[product][feature]),
          feature,
          idealDescription
        );
        results.push(res);
        // Small stagger to avoid hammering free-tier rate limits (Concern: 429 errors)
        await delay(200);
      }

      results.forEach(({ score, confidence, source }, idx) => {
        const product = products[idx];
        if (source === "AI_FAIL" || score === null) {
          // Leave raw text; mark as failure for frontend to handle
          ai_failures.push({ product, feature });
          metadata[product][feature] = { source: "AI_FAIL", confidence: null };
        } else {
          scored_data[product][feature] = score;
          metadata[product][feature] = { source, confidence };
        }
      });

      // Ideal for a review feature is already a description string.
      // Use the midpoint (5) as a numeric ideal — the AI-scored products
      // will naturally cluster relative to each other via normalization.
      // The ideal description is used only to *score* each product's review.
      // FIX 4: Anchor ideal to the best score actually achieved, not 10.
      // If the best product scores 7/10, anchoring at 10 unfairly penalizes
      // everyone. Using the best available score makes the winner penalty=0.
      const validScores = results
        .filter(r => r.source !== 'AI_FAIL' && r.score !== null)
        .map(r => r.score);
      scored_ideals[fi] = validScores.length > 0 ? Math.max(...validScores) : 10;
      continue;
    }
  }

  return { scored_data, scored_ideals, metadata, ai_failures };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLANATION SYSTEM (Phase 1 — unchanged)
// ─────────────────────────────────────────────────────────────────────────────

async function generateExplanation(result, f_list, raw_data) {
  const fallback = buildDataStyle(result, f_list, raw_data);
  const prompt = buildPrompt(result, f_list, raw_data);

  // ── Try Gemini first ──────────────────────────────────────────────────────
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("No Gemini key");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.6,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error("Empty Gemini response");
    if (!isDetailedExplanation(text)) console.log("Gemini explanation short but accepted:", text.length, "chars");
    if (text.length < 30) throw new Error("Gemini response too short");

    return { explanation: text, source: "gemini" };
  } catch (geminiError) {
    console.log("Gemini explanation failed:", geminiError.message);
  }

  // ── Try Groq second ───────────────────────────────────────────────────────
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("No Groq key");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 260,
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content: "You explain weighted decision outcomes in clear, simple language. Use the actual values the user entered. Never say 'penalty', 'normalized', or 'weighted points'.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty Groq response");
    if (!isDetailedExplanation(text)) throw new Error("Groq response too short");

    return { explanation: text, source: "groq" };
  } catch (groqError) {
    console.log("Groq explanation failed:", groqError.message);
  }

  return { explanation: fallback, source: "fallback" };
}
function isDetailedExplanation(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  return words >= 45 && sentences >= 3;
}

// ── Helper: get a display-friendly actual value ───────────────────────────────
function getActualValue(raw_data, product, feature) {
  if (!raw_data || !raw_data[product]) return null;
  const val = raw_data[product][feature];
  return val !== undefined && val !== null ? val : null;
}

// ── buildPrompt: tells AI to speak in actual values ───────────────────────────
function buildPrompt(result, f_list, raw_data) {
  const winner = result.winner || result.tie.join(" and ");
  const weightSummary = f_list
    .map((f, i) => `${f}: ${(result.weights[i] * 100).toFixed(0)}% importance`)
    .join(", ");

  const breakdownText = result.ranking
    .map(({ product }) => {
      const featureLines = f_list.map((f) => {
        const actual = getActualValue(raw_data, product, f);
        const b = result.detailed_breakdown[product][f];
        const met = b.penalty === 0 ? "meets ideal" : "does not meet ideal";
        return `  ${f}: ${actual !== null ? actual : "N/A"} (${met})`;
      });
      return `${product}:\n${featureLines.join("\n")}`;
    })
    .join("\n\n");

  return `A decision model chose ${winner}.
Criteria weights: ${weightSummary}.

Actual values entered by user:
${breakdownText}

Write exactly 4-5 sentences explaining WHY ${winner} won using the actual values above.
Do NOT mention "penalty", "normalized", "weighted points", or any math jargon.
Do NOT write just one sentence. Do NOT use an example format. Write a full paragraph.
Speak simply — like explaining to a friend.`;
}

// ── buildWeightSummary (kept for reference) ───────────────────────────────────
function buildWeightSummary(result, f_list) {
  return f_list
    .map((f, i) => `${f}: ${(result.weights[i] * 100).toFixed(1)}%`)
    .join(", ");
}

function getWinnerContext(result, f_list) {
  if (result.tie.length > 1 || !result.winner) return null;

  const winner = result.winner;
  const secondEntry = result.ranking.find((r) => r.product !== winner) || null;
  const winnerBreakdown = result.detailed_breakdown[winner];

  const ordered = [...f_list].sort(
    (a, b) => winnerBreakdown[a].weighted_penalty - winnerBreakdown[b].weighted_penalty
  );

  const perfectFeatures = ordered.filter((f) => winnerBreakdown[f].penalty === 0);
  const bestFeature = ordered[0];
  const worstFeature = ordered[ordered.length - 1];

  let topWeightIndex = 0;
  for (let i = 1; i < result.weights.length; i++) {
    if (result.weights[i] > result.weights[topWeightIndex]) topWeightIndex = i;
  }

  const winnerScore = result.agg_sum[winner];
  const secondScore = secondEntry ? result.agg_sum[secondEntry.product] : null;

  return {
    winner,
    second: secondEntry ? secondEntry.product : null,
    winnerScore,
    secondScore,
    gapToSecond:
      secondScore === null ? null : parseFloat((secondScore - winnerScore).toFixed(2)),
    winnerBreakdown,
    bestFeature,
    worstFeature,
    perfectFeatures,
    topWeightFeature: f_list[topWeightIndex],
    topWeightPct: result.weights[topWeightIndex] * 100,
  };
}

function buildFallbackExplanation(result, f_list, raw_data) {
  return buildDataStyle(result, f_list, raw_data);
}

function build4Styles(result, f_list, raw_data) {
  return {
    data: buildDataStyle(result, f_list, raw_data),
    story: buildStoryStyle(result, f_list, raw_data),
    compare: buildCompareStyle(result, f_list, raw_data),
    action: buildActionStyle(result, f_list, raw_data),
  };
}

// ── Data-Driven style ─────────────────────────────────────────────────────────
function buildDataStyle(result, f_list, raw_data) {
  if (result.tie.length > 1) {
    return `It's a tie between ${result.tie.join(" and ")}! Both options performed equally well. To get a clear winner, increase the importance of your most critical criterion or add a new one.`;
  }

  const ctx = getWinnerContext(result, f_list);
  const lines = [];

  lines.push(`✅ ${ctx.winner} is your best match.`);

  const featureSummary = f_list.map((f) => {
    const actual = getActualValue(raw_data, ctx.winner, f);
    const b = ctx.winnerBreakdown[f];
    const actualStr = actual !== null ? ` (${actual})` : "";
    return b.penalty === 0
      ? `${f}${actualStr} ✓`
      : `${f}${actualStr} ✗`;
  });
  lines.push(`Criteria check: ${featureSummary.join(", ")}.`);

  if (ctx.second) {
    const loserGaps = f_list.filter(
      (f) => result.detailed_breakdown[ctx.second][f].penalty > 0
    ).map((f) => {
      const actual = getActualValue(raw_data, ctx.second, f);
      return actual !== null ? `${f} (${actual})` : f;
    });
    if (loserGaps.length) {
      lines.push(`${ctx.second} fell short on: ${loserGaps.join(", ")}.`);
    }
  }

  const topIdx = result.weights.indexOf(Math.max(...result.weights));
  lines.push(`The deciding factor was "${f_list[topIdx]}" — your highest-priority criterion.`);

  return lines.join(" ");
}

// ── Storytelling style ────────────────────────────────────────────────────────
function buildStoryStyle(result, f_list, raw_data) {
  if (result.tie.length > 1) {
    return `No clear winner this time — ${result.tie.join(" and ")} are perfectly matched. Try increasing the importance of whichever criterion matters most to you right now.`;
  }

  const ctx = getWinnerContext(result, f_list);
  const topIdx = result.weights.indexOf(Math.max(...result.weights));
  const topFeature = f_list[topIdx];

  const winnerHighlights = f_list
    .filter((f) => ctx.winnerBreakdown[f].penalty === 0)
    .map((f) => {
      const actual = getActualValue(raw_data, ctx.winner, f);
      return actual !== null ? `${f} (${actual})` : f;
    });

  let text = `${ctx.winner} is the standout choice. `;
  if (winnerHighlights.length) {
    text += `It nails your target on ${winnerHighlights.join(", ")}. `;
  }
  if (ctx.second) {
    const secondGaps = f_list
      .filter((f) => result.detailed_breakdown[ctx.second][f].penalty > 0)
      .map((f) => {
        const actual = getActualValue(raw_data, ctx.second, f);
        return actual !== null ? `${f} at ${actual}` : f;
      });
    if (secondGaps.length) {
      text += `${ctx.second} couldn't quite keep up — it missed on ${secondGaps.join(", ")}. `;
    }
  }
  text += `In the end, "${topFeature}" was the tiebreaker — and ${ctx.winner} handled it best.`;
  return text;
}

// ── Comparative style ─────────────────────────────────────────────────────────
function buildCompareStyle(result, f_list, raw_data) {
  if (result.tie.length > 1) {
    return `${result.tie.join(" and ")} are tied — no difference under current priorities.\nTo separate them: raise the weight of your most important criterion or add a new one.`;
  }

  const lines = [`📊 Option comparison by criterion:\n`];

  f_list.forEach((feature) => {
    const cells = result.ranking.map(({ product }) => {
      const actual = getActualValue(raw_data, product, feature);
      const b = result.detailed_breakdown[product][feature];
      const met = b.penalty === 0 ? "✓" : "✗";
      return `${product}: ${actual !== null ? actual : "?"} ${met}`;
    });
    lines.push(`• ${feature} → ${cells.join("  |  ")}`);
  });

  const topIdx = result.weights.indexOf(Math.max(...result.weights));
  lines.push(`\n🏆 ${result.winner} wins — strongest on "${f_list[topIdx]}", your top priority.`);

  return lines.join("\n");
}

// ── Action style ──────────────────────────────────────────────────────────────
function buildActionStyle(result, f_list, raw_data) {
  if (result.tie.length > 1) {
    return `Decision: Either ${result.tie.join(" or ")} — both are equally good.\nNext step: choose based on availability, gut feel, or factors not in the model.`;
  }

  const ctx = getWinnerContext(result, f_list);
  const lines = [];

  lines.push(`✅ Go with: ${ctx.winner}`);

  const strengths = f_list
    .filter((f) => ctx.winnerBreakdown[f].penalty === 0)
    .map((f) => {
      const actual = getActualValue(raw_data, ctx.winner, f);
      return actual !== null ? `${f} (${actual})` : f;
    });

  const gaps = f_list
    .filter((f) => ctx.winnerBreakdown[f].penalty > 0)
    .map((f) => {
      const actual = getActualValue(raw_data, ctx.winner, f);
      return actual !== null ? `${f} (${actual})` : f;
    });

  if (strengths.length) lines.push(`Why: Hits your ideal on ${strengths.join(", ")}.`);
  if (gaps.length) lines.push(`Trade-off: Not perfect on ${gaps.join(", ")} — but still the best overall.`);
  if (ctx.second) lines.push(`Alternative: ${ctx.second} is next best if ${ctx.winner} isn't available.`);

  return lines.join("\n");
}

module.exports = {
  calculateDecision,
  generateExplanation,
  build4Styles,
  preprocessInputs,
  SCALE_MAP,
};