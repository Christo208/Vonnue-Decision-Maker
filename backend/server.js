// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
// Initialize global fetch for decisionLogic.js to use
import("node-fetch").then(m => global.fetch = m.default).catch(console.error);
const {
  calculateDecision,
  generateExplanation,
  build4Styles,
  preprocessInputs,
} = require("./decisionLogic");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/preprocess
// Phase 1.5: Converts scale strings and review texts → numeric scores via AI.
// Returns scored_data + metadata + ai_failures for the Approval Stage.
// Does NOT calculate the decision yet.
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/preprocess", async (req, res) => {
  try {
    const { products_data, features, feature_types, weights_raw, ideals, directions } =
      req.body;

    const { scored_data, scored_ideals, metadata, ai_failures } = await preprocessInputs(
      products_data,
      feature_types,
      features,
      ideals
    );

    // Force scale criteria to "higher is better" — Excellent > Very Good by definition.
    // Overrides any incorrect direction the frontend may have sent.
    const corrected_directions = directions.map((dir, i) =>
      feature_types[i] === 'scale' ? 'higher' : dir
    );

    res.json({
      scored_data,
      scored_ideals,
      metadata,
      ai_failures,
      // Pass through for the final /api/calculate call
      features,
      weights_raw,
      directions: corrected_directions,
    });
  } catch (error) {
    console.error("Preprocess error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calculate
// Receives fully numeric products_data (already preprocessed + user-approved).
// Runs the deterministic decision engine and generates explanations.
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/calculate", async (req, res) => {
  try {
    const { products_data, features, weights_raw, ideals, directions, metadata } =
      req.body;

    const result = calculateDecision(products_data, features, weights_raw, ideals, directions);

    // Attach input source metadata so the frontend can show badges
    if (metadata) {
      for (const product of Object.keys(result.detailed_breakdown)) {
        for (const feature of features) {
          if (metadata[product]?.[feature]) {
            result.detailed_breakdown[product][feature].inputSource =
              metadata[product][feature].source;
            result.detailed_breakdown[product][feature].confidence =
              metadata[product][feature].confidence;
          }
        }
      }
    }

    // Generate AI narrative explanation (Phase 1 — unchanged)
    const { explanation, source } = await generateExplanation(result, features, products_data);
    const styles = build4Styles(result, features, products_data);

    res.json({
      ...result,
      explanation,
      explanation_source: source,
      explanation_styles: styles,
      raw: products_data,
    });
  } catch (error) {
    console.error("Calculation error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Query Refinement, Search, Scrape
// ─────────────────────────────────────────────────────────────────────────────
const { scrapeProducts } = require('./scrapers/index');
const { saveComparison, listComparisons, deleteComparison, renameComparison } = require('./services/memoryService');
const { searchReliance } = require('./scrapers/relianceSearch');

// ── 1. Query Refinement ───────────────────────────────────────────────────────
// Takes a vague user query and returns 3–4 refined search suggestions.
// Falls back to a template object when AI fails.
app.post('/api/refine-query', async (req, res) => {
  const { query } = req.body;
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Query too short.' });
  }

  const prompt = `A user wants to search for products on Reliance Digital (reliancedigital.in), an Indian electronics retailer.

Their raw query is: "${query}"

Reliance Digital's search works best with SHORT, SPECIFIC queries in this format: [Brand] [Product Type] [Key Spec]
Examples of queries that work well on Reliance Digital:
- "Samsung 65 inch 4K TV"
- "Sony WH-1000XM5 headphones"
- "iPhone 15 128GB"
- "Boat Airdopes 141 earbuds"
- "LG 1.5 ton inverter AC"

Generate 3-4 search suggestions optimized for Reliance Digital:
- Keep each under 50 characters
- Use brand names where known
- Include specific model numbers if mentioned
- Include capacity/size/spec if relevant
- Avoid vague words like "best", "good", "latest"
- Use Indian market context

Output ONLY raw JSON, no markdown:
{
  "suggestions": ["...", "...", "..."],
  "template": {
    "fields": ["brand", "product_type", "key_spec"],
    "placeholder": "e.g. Samsung 65 inch 4K TV"
  }
}`;

  // Try Groq first (faster for short outputs)
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('No Groq key');

    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Groq ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error('Empty response');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found');
    const parsed = JSON.parse(match[0]);

    return res.json({ ...parsed, source: 'groq' });
  } catch (e) {
    console.log('Groq refine failed:', e.message);
  }

  // Try Gemini fallback
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('No Gemini key');

    const fetch2 = (await import('node-fetch')).default;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const response = await fetch2(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.4 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini ${response.status}`);
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) throw new Error('Empty response');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found');
    const parsed = JSON.parse(match[0]);

    return res.json({ ...parsed, source: 'gemini' });
  } catch (e) {
    console.log('Gemini refine failed:', e.message);
  }

  // Hard fallback: keyword-based template
  const isBrand = /samsung|apple|sony|lg|oneplus|realme|redmi|oppo|vivo|boat|jbl|bose/i.test(query);
  const isCategory = /phone|laptop|earphone|speaker|tv|watch|tablet|camera/i.test(query);

  const fallbackSuggestions = isBrand
    ? [
      `${query} smartphones under ₹20,000`,
      `${query} smartphones under ₹30,000`,
      `${query} flagship phones 2024`,
    ]
    : isCategory
      ? [
        `Best ${query} under ₹10,000`,
        `Best ${query} under ₹20,000`,
        `Top rated ${query} India 2024`,
      ]
      : [
        `${query} under ₹15,000`,
        `${query} under ₹25,000`,
        `Best ${query} India`,
      ];

  res.json({
    suggestions: fallbackSuggestions,
    template: {
      fields: ['product_type', 'budget'],
      placeholder: `e.g. ${query} under ₹_____`,
    },
    source: 'fallback',
  });
});

// ── 2. Reliance Digital Native Search ────────────────────────────────────────
// Replaces SerpAPI — uses Reliance's own internal catalog API (no key needed).
// Returns results in the same shape the frontend already expects.
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query required.' });
  }

  try {
    const items = await searchReliance(query.trim(), { pageSize: 12 });

    if (!items.length) {
      return res.status(404).json({
        error: 'No results found on Reliance Digital for that query.',
        results: [],
        query,
        total: 0,
      });
    }

    // Map to the shape the frontend already uses from the old SerpAPI route
    const results = items.map((item) => ({
      title: item.name,
      price: item.price ? `₹${item.price.toLocaleString('en-IN')}` : null,
      priceNum: item.price,
      source: 'Reliance Digital',
      link: item.url,
      thumbnail: item.image,
      rating: item.rating,
      reviews: null,   // not returned by search API; available after scrape
    }));

    res.json({ results, query, total: results.length, searchSource: 'reliance-native' });
  } catch (e) {
    console.error('[/api/search] Reliance search error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── 3. Scraper + AI Ideal Suggester ──────────────────────────────────────────
app.post('/api/scrape', async (req, res) => {
  const { urls, seedData = [] } = req.body;

  if (!Array.isArray(urls) || urls.length < 2 || urls.length > 8) {
    return res.status(400).json({ error: 'Provide between 2 and 8 product URLs.' });
  }

  const scrapeResults = await scrapeProducts(urls);
  const failed = scrapeResults.filter((r) => !r.success);
  const succeeded = scrapeResults.filter((r) => r.success).map((r) => r.data);

  if (succeeded.length < 2) {
    return res.status(422).json({
      error: 'Could not scrape enough products (need at least 2).',
      failures: failed.map((f) => ({ url: f.url, reason: f.error })),
    });
  }

  // Phase 2.5: Enrich products with AI Spec Extraction
  const enrichedProducts = await extractSpecsFromTitles(succeeded);

  // Merge search API seed data into products where scraper got generic fallback values
  enrichedProducts.forEach(p => {
    const seed = seedData.find(s => s.url === p.url);
    if (!seed) return;
    const genericName = !p.name || p.name.includes('Online Electronic Shopping') || p.name.length < 8;
    const wrongPrice = !p.price || p.price === 8000;
    if (genericName && seed.name) p.name = seed.name;
    if (genericName && seed.name) p.cleanName = seed.name;
    if (wrongPrice && seed.price) p.price = seed.price;
    if (!p.image && seed.image) p.image = seed.image;
    if (!p.rating && seed.rating) p.rating = seed.rating;
    console.log(`[Scrape] Merged seed data for: ${p.name}`);
  });

  // Find common spec keys (appear in ≥50% of products)
  const JUNK_SPEC_KEYS = new Set([
    'Item Code', 'Customer Care Phone', 'Customer care Phone', 'Customer care email',
    'Country of origin', 'Country of Origin', 'Net Weight', 'Commodity name', 'Commodity Name',
    'Item Length', 'Item Width', 'Item Height', 'Net Quantity',
    'Month and year of commodity first manufactured/packed/imported',
    'Month and Year of Commodity First Manufactured/Imported/Packed',
    'Name of Seller', 'EAN', 'In The Box',
  ]);

  const specKeyCounts = {};
  const globalCriteriaTypes = { 'Price (₹)': 'numeric', 'Rating (out of 5)': 'scale' };
  for (const p of enrichedProducts) {
    for (const [key, val] of Object.entries(p.specs)) {
      if (val && !JUNK_SPEC_KEYS.has(key)) specKeyCounts[key] = (specKeyCounts[key] || 0) + 1;
    }
    // merge criteriaTypes
    if (p.criteriaTypes) {
      for (const [key, type] of Object.entries(p.criteriaTypes)) {
        if (!globalCriteriaTypes[key]) globalCriteriaTypes[key] = type;
      }
    }
  }
  const threshold = Math.max(2, Math.floor(succeeded.length * 0.5));
  const ruled_out = Object.entries(specKeyCounts)
    .filter(([_, count]) => count < threshold && !JUNK_SPEC_KEYS.has(_))
    .map(([key]) => key);
  const commonSpecs = Object.entries(specKeyCounts)
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key]) => key);

  const hasPrice = enrichedProducts.some((p) => p.price !== null);
  const hasRating = enrichedProducts.some((p) => p.rating !== null);

  // Always include Price and Rating so criteria is never empty.
  // If scraped values are null the user can fill them in the Priorities step.
  const alwaysCriteria = ['Price (₹)', 'Rating (out of 5)'];
  const allCriteria = [...alwaysCriteria, ...commonSpecs];

  // Build products_data matrix
  const products_data = {};
  for (const p of enrichedProducts) {
    const shortName = p.cleanName || (p.name.length > 40 ? p.name.substring(0, 38) + '...' : p.name);
    products_data[shortName] = {};
    // Always include price and rating (null = user fills manually in priorities step)
    products_data[shortName]['Price (₹)'] = p.price ?? null;
    products_data[shortName]['Rating (out of 5)'] = p.rating ?? null;
    for (const spec of commonSpecs) {
      products_data[shortName][spec] = p.specs[spec] ?? null;
    }
  }

  // AI ideal suggestions
  const suggestions = await getAISuggestions(
    buildIdealSuggestionPrompt(products_data, allCriteria),
    allCriteria,
    products_data
  );

  // Identify criteria where ALL products have identical non-null values → not worth comparing
  const identicalCriteria = new Set();
  for (const criterion of allCriteria) {
    const vals = Object.values(products_data).map(p => p[criterion]);
    const nonNull = vals.filter(v => v !== null && v !== undefined && v !== '');
    if (nonNull.length === Object.keys(products_data).length && new Set(nonNull.map(String)).size === 1) {
      identicalCriteria.add(criterion);
    }
  }

  res.json({
    products: enrichedProducts.map((p) => ({
      name: p.name,
      shortName: p.cleanName || (p.name.length > 40 ? p.name.substring(0, 38) + '...' : p.name),
      price: p.price,
      rating: p.rating,
      reviewCount: p.reviewCount,
      image: p.image,
      url: p.url,
      source: p.source,
    })),
    criteria: allCriteria,
    criteriaTypes: globalCriteriaTypes,
    products_data,
    suggestions,
    identicalCriteria: [...identicalCriteria],
    ruled_out,
    failures: failed.map((f) => ({ url: f.url, reason: f.error })),
  });
});

// ── AI Ideal Suggestion helpers (shared) ──────────────────────────────────────
function buildIdealSuggestionPrompt(products_data, criteria) {
  const productNames = Object.keys(products_data);
  const dataStr = productNames
    .map((name) => {
      const vals = criteria.map((c) => `${c}: ${products_data[name][c] ?? 'N/A'}`).join(', ');
      return `${name}: { ${vals} }`;
    })
    .join('\n');

  return `You are a smart consumer advisor helping someone compare products on Reliance Digital India.

Here are the products being compared with their actual specs:
${dataStr}

Your task: for each criterion below, suggest the ideal target value that a typical Indian buyer would want.

Rules:
- For Price (₹): ideal = the lowest price shown minus 5-10%
- For Rating: ideal = 4.5
- For Battery/Capacity/Size specs: ideal = highest value shown
- For Weight: ideal = lowest value shown
- weight (1-5): how much does this criterion affect purchase decisions? Price=5, Rating=4, brand-specific specs=2-3
- direction: "lower" only for Price and Weight, "higher" for everything else
- reasoning: one sentence, specific to these products

IMPORTANT: ideal must always be a plain number. No units, no text. If a spec has units like "30 hours" or "5000 mAh", extract only the number.

Output ONLY raw JSON, no markdown, no backticks:
{ "CriterionName": { "ideal": 24990, "weight": 4, "direction": "lower", "reasoning": "..." }, ... }`;
}

async function getAISuggestions(prompt, criteria) {
  const fallback = {};
  for (const c of criteria) {
    const direction = ['price', 'weight', 'cost'].some((w) => c.toLowerCase().includes(w))
      ? 'lower'
      : 'higher';
    fallback[c] = { ideal: null, weight: 3, direction, reasoning: 'AI suggestion unavailable.' };
  }

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('No Groq key');
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Groq ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    const match = raw?.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    return { ...fallback, ...JSON.parse(match[0]) };
  } catch (e) {
    console.log('Groq suggestion failed:', e.message);
  }

  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('No Gemini key');
    const fetch2 = (await import('node-fetch')).default;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
    const response = await fetch2(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.3 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini ${response.status}`);
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const match = raw?.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');
    return { ...fallback, ...JSON.parse(match[0]) };
  } catch (e) {
    console.log('Gemini suggestion failed:', e.message);
  }

  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2.5 — Decision Memory Routes
// Add this block AFTER the existing scrape route in server.js
// Also add this near the top with other requires:
//   const { saveComparison, listComparisons, deleteComparison, renameComparison } = require('./services/memoryService');
// ─────────────────────────────────────────────────────────────────────────────

// ── Save a comparison ─────────────────────────────────────────────────────────
app.post('/api/memory/save', async (req, res) => {
  try {
    const { products, criteria, winner, result, products_data, source } = req.body;
    if (!products || !result) {
      return res.status(400).json({ error: 'products and result are required' });
    }
    const saved = await saveComparison({ products, criteria, winner, result, products_data, source });
    console.log(`[Memory] Saved: "${saved.title}"`);
    res.json({ success: true, entry: saved });
  } catch (e) {
    console.error('[/api/memory/save]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── List all comparisons ──────────────────────────────────────────────────────
app.get('/api/memory/list', async (req, res) => {
  try {
    const entries = await listComparisons();
    res.json({ entries });
  } catch (e) {
    console.error('[/api/memory/list]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Delete a comparison ───────────────────────────────────────────────────────
app.delete('/api/memory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await deleteComparison(id);
    if (!ok) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (e) {
    console.error('[/api/memory/:id DELETE]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Rename a comparison ───────────────────────────────────────────────────────
app.patch('/api/memory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const ok = await renameComparison(id, title);
    if (!ok) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (e) {
    console.error('[/api/memory/:id PATCH]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


async function extractSpecsFromTitles(products) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      console.log('No GROQ key, skipping spec extraction');
      return products.map(p => ({ ...p, cleanName: p.name, criteriaTypes: {} }));
    }

    const prompt = `You are an expert product data extractor. Your task is to process raw product data (messy titles, sparse specs) and output a standardized structured format.

Input Products:
${products.map((p, i) => `[${i}] Name: ${p.name}\nExisting Specs: ${JSON.stringify(p.specs || {})}`).join('\n\n')}

Goal:
1. Clean the product name into a concise 'cleanName' (e.g. "Lenovo Yoga Slim 7" instead of a long SEO title).
2. Extract key specifications from the raw name (like Processor, RAM, Storage, Display, GPU, Battery) and merge them with any Valid Existing Specs.
3. Determine the evaluation type ('criteriaType') for each spec.
   - "numeric" = measured in numbers (e.g., RAM size, Storage size, Battery Wh).
   - "review" = qualitative or categorical text (e.g., Processor model, GPU model, Display tech).
   - "scale" = 1-10 rating (not commonly extracted from titles, but available if needed).

Output ONLY raw JSON in this exact structure, with no markdown formatting:
{
  "products": [
    {
      "index": 0,
      "cleanName": "Cleaned Product Name",
      "specs": {
        "Processor": "...",
        "RAM": "16 GB",
        "Storage": "512 GB SSD"
      },
      "criteriaTypes": {
        "Processor": "review",
        "RAM": "numeric",
        "Storage": "numeric"
      }
    }
  ]
}`;

    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Groq api failed', response.status);
      return products.map(p => ({ ...p, cleanName: p.name, criteriaTypes: {} }));
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      console.error('Groq returned empty content');
      return products.map(p => ({ ...p, cleanName: p.name, criteriaTypes: {} }));
    }

    // Strip markdown codeblocks
    reply = reply.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found');
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('Spec extraction JSON parse failed:', parseErr.message);
      return products.map(p => ({ ...p, cleanName: p.name, criteriaTypes: {} }));
    }

    return products.map((p, i) => {
      const ext = parsed.products?.find(x => x.index === i);
      if (ext) {
        return {
          ...p,
          cleanName: ext.cleanName || p.name,
          specs: { ...p.specs, ...(ext.specs || {}) },  // raw scraped first, AI fills gaps
          criteriaTypes: ext.criteriaTypes || {}
        };
      }
      return { ...p, cleanName: p.name, criteriaTypes: {} };
    });

  } catch (e) {
    console.error('Spec extraction error:', e.message);
    return products.map(p => ({ ...p, cleanName: p.name, criteriaTypes: {} }));
  }
}


