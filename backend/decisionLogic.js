// decisionLogic.js
// Decision scoring is deterministic. Explanations are AI-assisted with
// robust template fallbacks and four user-facing narrative styles.

require("dotenv").config();

function calculateDecision(products_data, f_list, rate_list, req_list, high_or_low) {
  const total = rate_list.reduce((sum, r) => sum + r, 0);
  const weights = rate_list.map((r) => r / total);

  const d = JSON.parse(JSON.stringify(products_data));

  const min_max = {};
  for (const feature of f_list) {
    const values = Object.keys(d).map((p) => d[p][feature]);
    min_max[feature] = { min: Math.min(...values), max: Math.max(...values) };
  }

  for (const feature of f_list) {
    const { min: min_v, max: max_v } = min_max[feature];
    for (const p in d) {
      if (max_v === min_v) {
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
      norm_req_list.push(50.0);
    } else {
      norm_req_list.push(((req_list[i] - min_v) / (max_v - min_v)) * 100);
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

      if (high_or_low[x] === "True") {
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
      if (Math.abs(score - mvp_score) < 0.001) tie.push(product);
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
  };
}

async function generateExplanation(result, f_list) {
  const fallback = buildDataStyle(result, f_list);
  const prompt = buildPrompt(result, f_list);

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
            content:
              "You explain weighted decision outcomes in clear business language. Be specific and metric-driven.",
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
    console.log("Groq fallback:", groqError.message);
  }

  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("No Gemini key");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 260 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error("Empty Gemini response");
    if (!isDetailedExplanation(text)) throw new Error("Gemini response too short");

    return { explanation: text, source: "gemini" };
  } catch (geminiError) {
    console.log("Gemini fallback:", geminiError.message);
  }

  return { explanation: fallback, source: "fallback" };
}

function isDetailedExplanation(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  return words >= 45 && sentences >= 3;
}

function buildPrompt(result, f_list) {
  const winner = result.winner || result.tie.join(" and ");
  const weightSummary = buildWeightSummary(result, f_list);

  const rankingText = result.ranking
    .map((r) => `${r.rank}. ${r.product} (${r.score.toFixed(2)} pts)`)
    .join("\n");

  const breakdownText = result.ranking
    .map(({ product }) => {
      const lines = f_list.map((f) => {
        const b = result.detailed_breakdown[product][f];
        return `${f}: penalty ${b.penalty.toFixed(2)}, weighted ${b.weighted_penalty.toFixed(2)}, weight ${(b.weight * 100).toFixed(1)}%`;
      });
      return `${product}\n- ${lines.join("\n- ")}`;
    })
    .join("\n");

  return `A weighted-penalty decision model selected ${winner}.

Feature weights:
${weightSummary}

Ranking:
${rankingText}

Breakdown:
${breakdownText}

Write 5-7 sentences (90-140 words). Include: why #1 won, why #2 lost, strongest feature, key trade-off, and one practical recommendation. Keep it factual and concise.`;
}

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

function buildFallbackExplanation(result, f_list) {
  return buildDataStyle(result, f_list);
}

function build4Styles(result, f_list) {
  return {
    data: buildDataStyle(result, f_list),
    story: buildStoryStyle(result, f_list),
    compare: buildCompareStyle(result, f_list),
    action: buildActionStyle(result, f_list),
  };
}

function buildDataStyle(result, f_list) {
  if (result.tie.length > 1) {
    const tieLine = result.tie
      .map((p) => `${p} (${result.agg_sum[p].toFixed(2)} pts)`)
      .join(", ");
    return `The system found a tie: ${tieLine}. Each tied option produced the same weighted penalty total, so there is no mathematical winner under the current priorities. If you want a single winner, increase the weight of your most critical feature or add one more differentiating criterion.`;
  }

  const ctx = getWinnerContext(result, f_list);
  const winnerScore = ctx.winnerScore.toFixed(2);
  const secondScore = ctx.secondScore !== null ? ctx.secondScore.toFixed(2) : null;
  const worstPenalty = ctx.winnerBreakdown[ctx.worstFeature].weighted_penalty.toFixed(2);
  const bestWeight = ctx.winnerBreakdown[ctx.bestFeature].weight * 100;
  const perfectText = ctx.perfectFeatures.length
    ? `It has zero penalty on ${ctx.perfectFeatures.join(", ")}, including high-priority areas.`
    : `Its strongest contribution comes from ${ctx.bestFeature}, where weighted penalty is lowest.`;

  return `Based on your priorities, the system recommends ${ctx.winner} at ${winnerScore} points (lower is better). ${perfectText} ${ctx.second ? `${ctx.winner} outperforms ${ctx.second} by ${ctx.gapToSecond.toFixed(2)} points (${winnerScore} vs ${secondScore}).` : ""} The key trade-off is ${ctx.worstFeature}, adding ${worstPenalty} weighted points, but the stronger performance on higher-impact criteria keeps ${ctx.winner} in first place. Weight context: ${ctx.bestFeature} carries ${bestWeight.toFixed(1)}% importance in this model.`;
}

function buildStoryStyle(result, f_list) {
  if (result.tie.length > 1) {
    return `No single candidate separates from the pack. ${result.tie.join(" and ")} finish tied under your current priorities, which means their weaknesses and strengths balance out to the same final score. If speed matters, choose the one with lower implementation risk; if long-term upside matters, run a second pass with one additional criterion to break the tie.`;
  }

  const ctx = getWinnerContext(result, f_list);
  const secondName = ctx.second || "the next option";
  const topWeight = `${ctx.topWeightFeature} (${ctx.topWeightPct.toFixed(1)}%)`;
  const worstPenalty = ctx.winnerBreakdown[ctx.worstFeature].weighted_penalty.toFixed(2);

  return `${ctx.winner} emerges as the most balanced fit for what you asked the model to prioritize. ${secondName} has clear strengths, but it gives up too much ground where your weights are heaviest, especially ${topWeight}. ${ctx.winner} stays consistent across the board and avoids large misses on core criteria. The only notable gap is ${ctx.worstFeature}, which contributes ${worstPenalty} weighted points, but that shortfall is not large enough to overturn the overall lead. In short, the ranking rewards consistency on the criteria you marked as most important.`;
}

function buildCompareStyle(result, f_list) {
  if (result.tie.length > 1) {
    return `${result.tie.join(" and ")} scored identically.\n- Their weighted penalties are effectively the same.\n- There is no statistically meaningful difference under current weights.\n- To break the tie, raise one key weight or add another criterion.`;
  }

  const lines = [];
  const winner = result.winner;
  lines.push(`Why ${winner} ranks first:`);

  result.ranking.slice(0, 3).forEach(({ product, score }) => {
    const breakdown = result.detailed_breakdown[product];
    const best = [...f_list].sort(
      (a, b) => breakdown[a].weighted_penalty - breakdown[b].weighted_penalty
    )[0];
    const worst = [...f_list].sort(
      (a, b) => breakdown[b].weighted_penalty - breakdown[a].weighted_penalty
    )[0];
    lines.push(
      `- ${product}: score ${score.toFixed(2)} | strongest ${best} | biggest gap ${worst} (${breakdown[worst].weighted_penalty.toFixed(2)} pts)`
    );
  });

  const topWeightIndex = result.weights.reduce(
    (bestIdx, w, idx, arr) => (w > arr[bestIdx] ? idx : bestIdx),
    0
  );
  lines.push(
    `The ranking favors consistency on high-weight criteria, especially ${f_list[topWeightIndex]} (${(result.weights[topWeightIndex] * 100).toFixed(1)}%).`
  );

  return lines.join("\n");
}

function buildActionStyle(result, f_list) {
  if (result.tie.length > 1) {
    return `Decision: choose either ${result.tie.join(" or ")}.\nReason: both options produce the same weighted score.\nNext step: pick based on non-modeled constraints (budget, timeline, risk), or re-run with an added criterion to force separation.`;
  }

  const ctx = getWinnerContext(result, f_list);
  const lines = [];

  lines.push(`Decision: choose ${ctx.winner} (${ctx.winnerScore.toFixed(2)} pts).`);
  lines.push(`Why now: lowest total weighted penalty in the set.`);

  if (ctx.perfectFeatures.length) {
    lines.push(`Strengths: zero gap on ${ctx.perfectFeatures.join(", ")}.`);
  } else {
    lines.push(
      `Strength: strongest performance on ${ctx.bestFeature} (lowest weighted penalty).`
    );
  }

  lines.push(
    `Trade-off: ${ctx.worstFeature} contributes ${ctx.winnerBreakdown[ctx.worstFeature].weighted_penalty.toFixed(2)} weighted points.`
  );

  if (ctx.second && ctx.gapToSecond !== null) {
    lines.push(
      `Alternative: ${ctx.second} is next best, but trails by ${ctx.gapToSecond.toFixed(2)} points overall.`
    );
  }

  return lines.join("\n");
}

module.exports = { calculateDecision, generateExplanation, build4Styles };
