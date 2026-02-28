// script.js - Frontend logic (Phase 1.5: Hybrid Decision Engine)

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────────────────────
let state = {
  numProducts: 0,
  numFeatures: 0,
  featureNames: [],
  featureWeights: [],
  featureDirections: [],
  featureTypes: [],       // Phase 1.5: "numeric" | "scale" | "review"
  products: {},
  ideals: [],
  rawProductInputs: {},   // Stores raw text/scale before preprocessing
};

// Phase 1.5: holds preprocessed data pending approval
let pendingPreprocessed = null;

let currentStyleIndex = 0;
let allStyles = null;
const styleNames = ['data', 'story', 'compare', 'action'];
const styleLabels = ['📊 Data-Driven', '📖 Storytelling', '⚖️ Comparative', '⚡ Actionable'];

const SCALE_OPTIONS = [
  "Excellent", "Very Good", "Good", "Above Average", "Average", "Below Average", "Poor"
];
const RUNTIME_BUILD_ID = "runtime-source-fix-2026-02-25-1";
console.log("[DecisionCompanion] Script build:", RUNTIME_BUILD_ID, "URL:", window.location.href);

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function showLoading(phase = 1) {
  const overlay = document.getElementById('loading-overlay');
  const text = document.getElementById('loading-text');
  overlay.classList.remove('hidden');
  if (phase === 1) text.textContent = '🔍 Optimizing to requirements...';
  if (phase === 2) text.textContent = '⚙️ Calculating scores...';
  if (phase === 3) text.textContent = '✅ Scores ready — reviewing...';
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: SETUP
// ─────────────────────────────────────────────────────────────────────────────
function startSetup() {
  const numProducts = parseInt(document.getElementById('num-products').value);
  const numFeatures = parseInt(document.getElementById('num-features').value);

  if (numProducts < 2) { alert('⚠️ Please enter at least 2 options to compare.'); return; }
  if (numFeatures < 1) { alert('⚠️ Please enter at least 1 criterion.'); return; }

  state.numProducts = numProducts;
  state.numFeatures = numFeatures;

  generateFeaturesForm();
  showStep('step-features');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: CRITERIA — now includes Type selector
// ─────────────────────────────────────────────────────────────────────────────
function generateFeaturesForm() {
  const container = document.getElementById('features-container');
  container.innerHTML = '';

  for (let i = 0; i < state.numFeatures; i++) {
    const featureDiv = document.createElement('div');
    featureDiv.className = 'feature-input';
    featureDiv.innerHTML = `
            <h3>Criterion ${i + 1}</h3>
            <div class="feature-row">
                <div class="form-group">
                    <label>Criterion Name:</label>
                    <input type="text" id="feature-name-${i}" placeholder="e.g., Price, Quality" required>
                </div>
                <div class="form-group">
                    <label>Importance (1-5):</label>
                    <input type="number" id="feature-weight-${i}" min="0.1" step="0.1" value="3" required>
                </div>
                <div class="form-group">
                    <label>Better When:</label>
                    <select id="feature-direction-${i}">
                        <option value="False">Lower</option>
                        <option value="True">Higher</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Input Type:</label>
                <select id="feature-type-${i}" onchange="updateTypeHint(${i})">
                    <option value="numeric">🔢 Numeric (e.g., 50000, 8.5)</option>
                    <option value="scale">📊 Scale (Excellent → Poor)</option>
                    <option value="review">✍️ Review (AI interprets text)</option>
                </select>
                <span class="hint" id="type-hint-${i}">Enter a raw number for this criterion.</span>
            </div>
        `;
    container.appendChild(featureDiv);
  }
}

function updateTypeHint(i) {
  const type = document.getElementById(`feature-type-${i}`).value;
  const hint = document.getElementById(`type-hint-${i}`);
  const hints = {
    numeric: 'Enter a raw number for this criterion.',
    scale: 'Choose a grade from Excellent to Poor.',
    review: 'Enter a written description. AI will convert it to a 1-10 score.',
  };
  hint.textContent = hints[type];
}

function goToProducts() {
  state.featureNames = [];
  state.featureWeights = [];
  state.featureDirections = [];
  state.featureTypes = [];

  for (let i = 0; i < state.numFeatures; i++) {
    const name = document.getElementById(`feature-name-${i}`).value.trim();
    const weight = parseFloat(document.getElementById(`feature-weight-${i}`).value);
    const direction = document.getElementById(`feature-direction-${i}`).value;
    const type = document.getElementById(`feature-type-${i}`).value;

    if (!name) { alert(`⚠️ Please enter a name for Criterion ${i + 1}`); return; }
    if (state.featureNames.includes(name)) { alert(`⚠️ Criterion name "${name}" already used.`); return; }
    if (weight <= 0) { alert(`⚠️ Importance for "${name}" must be positive.`); return; }

    state.featureNames.push(name);
    state.featureWeights.push(weight);
    state.featureDirections.push(direction);
    state.featureTypes.push(type);
  }

  generateProductsForm();
  showStep('step-products');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: PRODUCTS — dynamic inputs by type
// ─────────────────────────────────────────────────────────────────────────────
function generateProductsForm() {
  const container = document.getElementById('products-container');
  container.innerHTML = '';

  for (let i = 0; i < state.numProducts; i++) {
    const productDiv = document.createElement('div');
    productDiv.className = 'product-section';

    let featuresHTML = '';
    state.featureNames.forEach((feature, idx) => {
      const type = state.featureTypes[idx];
      let inputHTML = '';

      if (type === 'numeric') {
        inputHTML = `<input type="number" id="product-${i}-feature-${idx}" step="any" required>`;
      } else if (type === 'scale') {
        inputHTML = `<select id="product-${i}-feature-${idx}">
                    ${SCALE_OPTIONS.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>`;
      } else if (type === 'review') {
        inputHTML = `<textarea id="product-${i}-feature-${idx}" rows="3"
                    placeholder="Describe this aspect of the option..." style="width:100%;padding:10px;border:2px solid #e2e8f0;border-radius:8px;font-size:15px;resize:vertical;"></textarea>`;
      }

      const typeBadge = type === 'numeric' ? '' : type === 'scale' ? ' <span class="input-badge badge-scale">Scale</span>' : ' <span class="input-badge badge-review">Review</span>';
      featuresHTML += `
                <div class="form-group">
                    <label>${feature}:${typeBadge}</label>
                    ${inputHTML}
                </div>
            `;
    });

    productDiv.innerHTML = `
            <h3>Option ${i + 1}</h3>
            <div class="form-group">
                <label>Option Name:</label>
                <input type="text" id="product-name-${i}" placeholder="e.g., Juice A" required>
            </div>
            ${featuresHTML}
        `;
    container.appendChild(productDiv);
  }
}

function goToIdeals() {
  state.products = {};
  state.rawProductInputs = {};

  for (let i = 0; i < state.numProducts; i++) {
    const productName = document.getElementById(`product-name-${i}`).value.trim();
    if (!productName) { alert(`⚠️ Please enter a name for Option ${i + 1}`); return; }
    if (state.products[productName]) { alert(`⚠️ Option name "${productName}" already used.`); return; }

    state.products[productName] = {};
    state.rawProductInputs[productName] = {};

    state.featureNames.forEach((feature, idx) => {
      const rawVal = state.featureTypes[idx] === 'numeric'
        ? parseFloat(document.getElementById(`product-${i}-feature-${idx}`).value)
        : document.getElementById(`product-${i}-feature-${idx}`).value;

      state.products[productName][feature] = rawVal;
      state.rawProductInputs[productName][feature] = rawVal;
    });
  }

  generateIdealsForm();
  showStep('step-ideals');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: IDEALS — dynamic by type
// ─────────────────────────────────────────────────────────────────────────────
function generateIdealsForm() {
  const container = document.getElementById('ideals-container');
  container.innerHTML = '';

  state.featureNames.forEach((feature, idx) => {
    const type = state.featureTypes[idx];
    const idealDiv = document.createElement('div');
    idealDiv.className = 'form-group';

    let inputHTML = '';
    let hintText = '';

    if (type === 'numeric') {
      inputHTML = `<input type="number" id="ideal-${idx}" step="any" required>`;
      hintText = `Your target numeric value for ${feature}`;
    } else if (type === 'scale') {
      inputHTML = `<select id="ideal-${idx}">
                ${SCALE_OPTIONS.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
            </select>`;
      hintText = `What grade would be ideal for ${feature}?`;
    } else if (type === 'review') {
      inputHTML = `<input type="text" id="ideal-${idx}" placeholder="e.g., Healthy and tasty" required>`;
      hintText = `Short target description for "${feature}". AI will use this to score all reviews.`;
    }

    idealDiv.innerHTML = `
            <label>Ideal ${feature}:</label>
            ${inputHTML}
            <span class="hint">${hintText}</span>
        `;
    container.appendChild(idealDiv);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 → PREPROCESS: Collect ideals, call /api/preprocess, show loading
// ─────────────────────────────────────────────────────────────────────────────
async function calculateResult() {
  state.ideals = [];

  for (let i = 0; i < state.numFeatures; i++) {
    const type = state.featureTypes[i];
    const rawVal = document.getElementById(`ideal-${i}`).value;
    state.ideals.push(type === 'numeric' ? parseFloat(rawVal) : rawVal);
  }

  // Check if any review features exist — if not, skip preprocess and go straight to calculate
  const hasReviews = state.featureTypes.includes('review');
  const hasScale = state.featureTypes.includes('scale');

  if (!hasReviews && !hasScale) {
    // Pure numeric — use Phase 1 path directly
    await runCalculate(state.products, state.ideals, null);
    return;
  }

  // Phase 1.5 path: preprocess first
  showLoading(1);

  try {
    const preprocessResponse = await fetch('/api/preprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products_data: state.products,
        features: state.featureNames,
        feature_types: state.featureTypes,
        weights_raw: state.featureWeights,
        ideals: state.ideals,
        directions: state.featureDirections,
      }),
    });

    showLoading(2);

    if (!preprocessResponse.ok) throw new Error('Preprocessing failed');

    const preprocessed = await preprocessResponse.json();
    pendingPreprocessed = preprocessed;

    showLoading(3);
    setTimeout(() => {
      hideLoading();
      showApprovalStage(preprocessed);
    }, 800);

  } catch (error) {
    hideLoading();
    alert('❌ Error during preprocessing: ' + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4.5: APPROVAL STAGE
// ─────────────────────────────────────────────────────────────────────────────
function showApprovalStage(preprocessed) {
  const { scored_data, metadata, ai_failures } = preprocessed;
  const container = document.getElementById('approval-container');
  container.innerHTML = '';

  // Only show approval for non-numeric features
  const reviewFeatures = state.featureNames.filter(
    (_, fi) => state.featureTypes[fi] === 'review'
  );

  if (reviewFeatures.length === 0) {
    // No review features to approve — auto-confirm
    confirmApproval();
    return;
  }

  if (ai_failures.length > 0) {
    const failureNames = ai_failures.map(f => `${f.product} / ${f.feature}`).join(', ');
    container.innerHTML += `
            <div class="warning-alert">
                ⚠️ AI could not interpret these reviews: <strong>${failureNames}</strong>. 
                Please override them manually using the Scale below.
            </div>`;
  }

  reviewFeatures.forEach(feature => {
    const fi = state.featureNames.indexOf(feature);
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'approval-section';
    sectionDiv.innerHTML = `<h4>📝 ${feature} <span class="feature-ideal-tag">Ideal: "${state.ideals[fi]}"</span></h4>`;

    const table = document.createElement('table');
    table.className = 'approval-table';
    table.innerHTML = `<thead><tr><th>Option</th><th>Review Text</th><th>AI Score</th><th>Source</th><th>Override</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    Object.keys(state.rawProductInputs).forEach(product => {
      const rawText = state.rawProductInputs[product][feature];
      const meta = metadata[product]?.[feature] || {};
      const aiScore = scored_data[product]?.[feature];
      const isFailure = meta.source === 'AI_FAIL';
      const isLowConf = meta.confidence === 'low';

      const sourceTag = isFailure
        ? '<span class="badge-fail">AI Failed</span>'
        : meta.source === 'gemini'
          ? '<span class="badge-gemini">Gemini</span>'
          : '<span class="badge-groq">Groq</span>';

      const confidenceWarning = isLowConf
        ? '<span class="badge-low-conf" title="Review may be off-topic">⚠️ Low</span>'
        : '';

      const scoreDisplay = isFailure ? '—' : `${aiScore}/10`;

      const row = document.createElement('tr');
      if (isFailure) row.classList.add('row-failure');
      if (isLowConf) row.classList.add('row-warning');

      row.innerHTML = `
                <td><strong>${product}</strong></td>
                <td class="review-text-cell">${rawText}</td>
                <td class="score-cell">${scoreDisplay} ${confidenceWarning}</td>
                <td>${sourceTag}</td>
                <td>
                    <select id="override-${product}-${fi}" class="override-select" onchange="applyOverride('${product}', ${fi}, this.value)">
                        <option value="">— Keep AI —</option>
                        ${SCALE_OPTIONS.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                </td>
            `;
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    sectionDiv.appendChild(table);
    container.appendChild(sectionDiv);
  });

  showStep('step-approval');
}

// Apply an override from the approval table into pendingPreprocessed
function applyOverride(product, featureIndex, scaleValue) {
  if (!scaleValue || !pendingPreprocessed) return;

  const SCALE_MAP = {
    "Excellent": 10, "Very Good": 9, "Good": 8, "Above Average": 7,
    "Average": 6, "Below Average": 5, "Poor": 4
  };
  const numeric = SCALE_MAP[scaleValue];
  if (numeric !== undefined) {
    pendingPreprocessed.scored_data[product][state.featureNames[featureIndex]] = numeric;
    // Update metadata so badge shows correctly
    if (!pendingPreprocessed.metadata[product]) pendingPreprocessed.metadata[product] = {};
    pendingPreprocessed.metadata[product][state.featureNames[featureIndex]] = {
      source: 'scale', confidence: null
    };
    // Remove from ai_failures if present
    pendingPreprocessed.ai_failures = pendingPreprocessed.ai_failures.filter(
      f => !(f.product === product && f.feature === state.featureNames[featureIndex])
    );
  }
}

// Confirm approval and run the final calculation
async function confirmApproval() {
  // Check for unresolved AI failures
  if (pendingPreprocessed && pendingPreprocessed.ai_failures.length > 0) {
    const failNames = pendingPreprocessed.ai_failures.map(f => `${f.product}/${f.feature}`).join(', ');
    alert(`⚠️ Please override the AI-failed scores before continuing:\n${failNames}`);
    return;
  }

  const data = pendingPreprocessed || { scored_data: state.products, scored_ideals: state.ideals, metadata: null };
  await runCalculate(data.scored_data, data.scored_ideals, data.metadata);
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CALCULATION
// ─────────────────────────────────────────────────────────────────────────────
async function runCalculate(products_data, ideals, metadata) {
  showLoading(2);
  try {
    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products_data,
        features: state.featureNames,
        weights_raw: state.featureWeights,
        ideals,
        directions: state.featureDirections,
        metadata,
      }),
    });

    if (!response.ok) throw new Error('Calculation failed');

    const result = await response.json();
    hideLoading();
    displayResults(result);
    showStep('step-results');

  } catch (error) {
    hideLoading();
    alert('❌ Error calculating decision: ' + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS DISPLAY (Phase 1 + Phase 1.5 badges)
// ─────────────────────────────────────────────────────────────────────────────
// Builds { FeatureName: rawIdealValue } from state.ideals + state.featureNames
// Used to populate the visualizer's ideals display
function buildRawIdealsMap(result) {
  const map = {};
  state.featureNames.forEach((name, i) => {
    map[name] = state.ideals[i];
  });
  return map;
}

function openVisualizer(dataJson) {
  // Remove any prior overlay so we always use the latest payload/runtime.
  const existingOverlay = document.getElementById('visualizer-overlay');
  if (existingOverlay) existingOverlay.remove();

  let payload = dataJson;
  if (typeof dataJson === 'string') {
    try {
      payload = JSON.parse(dataJson);
    } catch (e) {
      console.error('Visualizer payload parse failed:', e);
      return;
    }
  }

  // Source-of-truth lives on this parent window before iframe bootstraps.
  window.__VISUALIZER_DATA__ = payload;
  window.__VISUALIZER_SOURCE__ = {
    build: RUNTIME_BUILD_ID,
    url: window.location.href,
    ts: Date.now(),
  };

  // Create fullscreen overlay iframe.
  const overlay = document.createElement('div');
  overlay.id = 'visualizer-overlay';
  overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: #0a0a1a; z-index: 9999; display: flex; flex-direction: column;
    `;

  const closeBar = document.createElement('div');
  closeBar.style.cssText = `
        position: absolute; top: 0; right: 0; z-index: 10000; padding: 8px;
    `;
  closeBar.innerHTML = `
        <button onclick="document.getElementById('visualizer-overlay').remove()"
            style="background:rgba(255,255,255,0.15);border:none;color:white;
                   padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px;">
            Close
        </button>
    `;

  const iframe = document.createElement('iframe');
  iframe.src = `/visualizer_prototype.html?build=${encodeURIComponent(RUNTIME_BUILD_ID)}&ts=${Date.now()}`;
  iframe.style.cssText = 'width:100%;height:100%;border:none;flex:1;';

  overlay.appendChild(closeBar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

function displayResults(result) {
  const container = document.getElementById('results-container');

  allStyles = result.explanation_styles || null;
  currentStyleIndex = 0;

  let html = '';

  if (result.tie.length === 1) {
    html += `
            <div class="winner-card">
                <h3>🏆 Recommended Choice</h3>
                <div style="font-size: 2.5rem; margin: 16px 0;">${result.winner}</div>
                <div>Score: ${result.agg_sum[result.winner].toFixed(2)} points</div>
            </div>
        `;
  } else {
    html += `
            <div class="tie-alert">
                <h3>🤝 Tie Detected</h3>
                <p>The following options are equally optimal:</p>
                <ul>${result.tie.map(p => `<li>${p}</li>`).join('')}</ul>
            </div>
        `;
  }

  html += `
        <div class="explanation-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3>💡 Why This Result?</h3>
                <button onclick="cycleExplanation()" class="refresh-btn">
                    🔄 <span id="style-label">${styleLabels[0]}</span>
                </button>
            </div>
            <p id="explanation-text">${result.explanation}</p>
            <span class="source-tag">${result.explanation_source === 'groq' ? '⚡ Groq' : result.explanation_source === 'gemini' ? '🤖 Gemini' : '📋 Template'}</span>
        </div>
    `;

  html += `
        <h3>📊 Complete Ranking</h3>
        <ul class="ranking-list">
            ${result.ranking.map(item => `
                <li>
                    <span class="rank-number">#${item.rank}</span>
                    <span class="product-name">${item.product}</span>
                    <span class="score">${item.score.toFixed(2)} pts</span>
                </li>
            `).join('')}
        </ul>
    `;

  html += `
        <div class="breakdown-section">
            <h3>🔍 Detailed Breakdown</h3>
            ${Object.keys(result.detailed_breakdown).map(product => `
                <div class="breakdown-product">
                    <h4>${product} (Total: ${result.agg_sum[product].toFixed(2)} points)</h4>
                    ${state.featureNames.map((feature) => {
    const breakdown = result.detailed_breakdown[product][feature];
    const src = breakdown.inputSource;
    let badge = '';
    if (src === 'gemini') badge = '<span class="input-badge badge-gemini">AI: Gemini</span>';
    else if (src === 'groq') badge = '<span class="input-badge badge-groq">AI: Groq</span>';
    else if (src === 'scale') badge = '<span class="input-badge badge-scale">Scale</span>';
    else if (src === 'numeric') badge = '<span class="input-badge badge-numeric">Numeric</span>';

    const lowConfWarn = breakdown.confidence === 'low'
      ? ' <span class="badge-low-conf" title="AI flagged this review as potentially off-topic">⚠️</span>' : '';

    return `
                            <div class="breakdown-row">
                                <span>${feature}: ${badge}${lowConfWarn}</span>
                                <span>
                                    Penalty: ${breakdown.penalty.toFixed(2)} ×
                                    Weight: ${(breakdown.weight * 100).toFixed(1)}% =
                                    ${breakdown.weighted_penalty.toFixed(2)} pts
                                </span>
                            </div>
                        `;
  }).join('')}
                </div>
            `).join('')}
        </div>
    `;

  const vizPayload = JSON.stringify({
    candidates: result.ranking.map(r => r.product),
    features: result.features,
    weights: result.weights,
    raw: result.raw,
    normed: result.normed,
    normedIdeals: result.normedIdeals,
    ideals: buildRawIdealsMap(result),
    detailed_breakdown: result.detailed_breakdown,
    ranking: result.ranking,
    winner: result.winner,
    explanation: result.explanation,
  });
  window.__pendingVizData__ = vizPayload;

  html += `
      <div style="margin-top: 24px; text-align: center;">
        <button onclick="openVisualizer(window.__pendingVizData__)" class="btn-primary" style="font-size:1.1rem; padding: 14px 32px;">
          🎬 Animate Result
        </button>
        <p class="hint" style="margin-top: 8px;">Watch the decision play out step-by-step</p>
      </div>
    `;

  container.innerHTML = html;
}

function cycleExplanation() {
  if (!allStyles) return;
  currentStyleIndex = (currentStyleIndex + 1) % 4;
  const styleName = styleNames[currentStyleIndex];
  const nextText = allStyles[styleName];
  if (!nextText) return;
  document.getElementById('explanation-text').textContent = nextText;
  document.getElementById('style-label').textContent = styleLabels[currentStyleIndex];
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
function showStep(stepId) {
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
}

function goBack(stepId) {
  showStep(stepId);
}

function resetForm() {
  state = {
    numProducts: 0, numFeatures: 0,
    featureNames: [], featureWeights: [], featureDirections: [], featureTypes: [],
    products: {}, ideals: [], rawProductInputs: {},
  };
  pendingPreprocessed = null;
  showStep('step-setup');
}

// -----------------------------------------------------------------------------
// PHASE 2 � SMART COMPARE
// -----------------------------------------------------------------------------

let smartState = {
  query: '',
  searchResults: [],
  selectedUrls: [],
  scrapeResult: null,
};

// -- Tab switching --------------------------------------------------------------
function switchTab(tab) {
  document.getElementById('tab-manual').classList.toggle('hidden', tab !== 'manual');
  document.getElementById('tab-smart').classList.toggle('hidden', tab !== 'smart');
  document.getElementById('tab-manual-btn').classList.toggle('active', tab === 'manual');
  document.getElementById('tab-amazon-btn').classList.toggle('active', tab === 'smart');
}

// -- Step 0: Query Refinement ---------------------------------------------------
async function refineQuery() {
  const input = document.getElementById('smart-query-input');
  const query = input.value.trim();
  const errorEl = document.getElementById('smart-search-error');
  errorEl.classList.add('hidden');

  if (!query || query.length < 2) {
    errorEl.textContent = '?? Please enter a search term.';
    errorEl.classList.remove('hidden');
    return;
  }

  smartState.query = query;
  showLoading(1);

  try {
    const res = await fetch('/api/refine-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    hideLoading();

    if (data.suggestions?.length > 0) {
      renderSuggestions(data.suggestions, query);
    } else if (data.template) {
      renderTemplate(data.template, query);
    }
  } catch (e) {
    hideLoading();
    await runSearch(query);
  }
}

function renderSuggestions(suggestions, originalQuery) {
  const panel = document.getElementById('smart-suggestions');
  const chips = document.getElementById('suggestion-chips');
  chips.innerHTML = '';

  [originalQuery, ...suggestions].forEach((s, idx) => {
    const chip = document.createElement('button');
    chip.className = 'suggestion-chip' + (idx === 0 ? ' chip-original' : '');
    chip.textContent = idx === 0 ? `"${s}" (original)` : s;
    chip.onclick = () => confirmAndSearch(s);
    chips.appendChild(chip);
  });

  panel.classList.remove('hidden');
  document.getElementById('smart-template').classList.add('hidden');
}

function renderTemplate(template, query) {
  const panel = document.getElementById('smart-template');
  const fields = document.getElementById('template-fields');
  fields.innerHTML = '';

  template.fields.forEach((field) => {
    const label = field.replace(/_/g, ' ');
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `<label>${label}:</label><input type="text" id="tpl-${field}" placeholder="${template.placeholder || ''}" />`;
    fields.appendChild(div);
  });

  panel.classList.remove('hidden');
  document.getElementById('smart-suggestions').classList.add('hidden');
}

function buildFromTemplate() {
  const fields = document.querySelectorAll('#template-fields input');
  const parts = Array.from(fields).map((f) => f.value.trim()).filter(Boolean);
  if (!parts.length) return;
  const built = parts.join(' ');
  document.getElementById('smart-query-input').value = built;
  confirmAndSearch(built);
}

function confirmAndSearch(query) {
  const confirmed = confirm(`Search for: "${query}"?`);
  if (confirmed) runSearch(query);
}

// -- Step 1: Search -------------------------------------------------------------
async function runSearch(query) {
  showLoading(1);
  const errorEl = document.getElementById('smart-search-error');
  errorEl.classList.add('hidden');

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    hideLoading();

    if (!res.ok) {
      // No results found is a soft failure — show empty grid with URL fallback
      if (res.status === 404) {
        renderSearchResults([], query);
        showAmazonStep('step-smart-results');
        const subtitle = document.getElementById('smart-results-subtitle');
        subtitle.innerHTML = `⚠️ No results found for "<strong>${query}</strong>" on Reliance Digital. Try a different search or paste URLs below.`;
        const details = document.querySelector('#smart-url-fallback details');
        if (details) details.open = true;
        return;
      }
      errorEl.textContent = `❌ ${data.error || 'Search failed'}`;
      errorEl.classList.remove('hidden');
      return;
    }

    smartState.searchResults = data.results;
    renderSearchResults(data.results, query);
    showAmazonStep('step-smart-results');
  } catch (e) {
    hideLoading();
    errorEl.textContent = `❌ Network error: ${e.message}`;
    errorEl.classList.remove('hidden');
  }
}

function renderSearchResults(results, query) {
  const grid = document.getElementById('smart-result-grid');
  const subtitle = document.getElementById('smart-results-subtitle');
  subtitle.textContent = `Results for "${query}" � select 2�5 to compare.`;
  grid.innerHTML = '';

  if (!results.length) {
    grid.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;">No results found. Try pasting URLs directly below.</p>';
    return;
  }

  results.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'search-result-card';
    card.dataset.url = r.link;
    card.innerHTML = `
      <label class="search-card-label">
        <input type="checkbox" class="search-card-check" value="${r.link}" />
        <div class="search-card-inner">
          ${r.thumbnail ? `<img src="${r.thumbnail}" class="search-thumb" alt="" />` : '<div class="search-thumb-placeholder">??</div>'}
          <div class="search-card-info">
            <div class="search-card-title">${r.title}</div>
            <div class="search-card-meta">
              ${r.price ? `<span class="search-price">${r.price}</span>` : ''}
              ${r.rating ? `<span class="search-rating">? ${r.rating}</span>` : ''}
              ${r.source ? `<span class="search-source">${r.source}</span>` : ''}
            </div>
          </div>
        </div>
      </label>
    `;
    grid.appendChild(card);
  });
}

function addSmartUrlField() {
  const container = document.getElementById('manual-url-inputs');
  const count = container.querySelectorAll('.smart-url-field').length;
  if (count >= 5) { alert('Maximum 5 URLs.'); return; }
  const row = document.createElement('div');
  row.className = 'url-input-row';
  row.innerHTML = `<label>URL ${count + 1}</label><input type="url" class="smart-url-field" placeholder="https://www.croma.com/..." />`;
  container.appendChild(row);
}

// -- Step 2: Scrape selected ----------------------------------------------------
async function startSmartScrape() {
  const errorEl = document.getElementById('smart-scrape-error');
  errorEl.classList.add('hidden');

  const checked = Array.from(document.querySelectorAll('.search-card-check:checked')).map((cb) => cb.value);
  const manualUrls = Array.from(document.querySelectorAll('.smart-url-field')).map((i) => i.value.trim()).filter(Boolean);
  const urls = [...new Set([...checked, ...manualUrls])];

  if (urls.length < 2) {
    errorEl.textContent = '?? Select or paste at least 2 products to compare.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (urls.length > 5) {
    errorEl.textContent = '?? Maximum 5 products.';
    errorEl.classList.remove('hidden');
    return;
  }

  showLoading(1);

  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls,
        seedData: urls.map(url => {
          const match = smartState.searchResults.find(r => r.link === url);
          return match ? {
            url,
            name: match.title,
            price: match.priceNum,
            image: match.thumbnail,
            rating: match.rating,
          } : { url };
        })
      }),
    });
    const data = await res.json();
    hideLoading();

    if (!res.ok) {
      errorEl.textContent = `? ${data.error}`;
      errorEl.classList.remove('hidden');
      return;
    }

    smartState.scrapeResult = data;
    renderSmartPreview(data);
    showAmazonStep('step-smart-preview');
  } catch (e) {
    hideLoading();
    errorEl.textContent = `? ${e.message}`;
    errorEl.classList.remove('hidden');
  }
}

function renderSmartPreview(data) {
  const container = document.getElementById('smart-preview-cards');
  container.innerHTML = '';

  const { products, products_data, criteria } = data;

  // ── Summary note about data sources ──────────────────────────────────────
  const noteEl = document.createElement('div');
  noteEl.className = 'scrape-source-note';
  noteEl.innerHTML = `
    <span>📋 Showing all fetched data below. Values marked
    <span class="tag-inferred">inferred</span> were estimated from the
    product title — verify before running.</span>
  `;
  container.appendChild(noteEl);

  products.forEach((p) => {
    const shortName = p.shortName || p.name;
    const productRow = products_data?.[shortName] || {};
    const sourceBadge = p.source === 'croma'
      ? '<span class="source-badge croma-badge">Croma</span>'
      : '<span class="source-badge reliance-badge">Reliance Digital</span>';

    // Build spec rows for this product
    const specRows = criteria
      ? criteria.map(c => {
        const val = productRow[c];
        const isEmpty = val === null || val === undefined || val === '';
        return `
            <tr>
              <td class="spec-key">${c}</td>
              <td class="spec-val ${isEmpty ? 'spec-missing' : ''}">
                ${isEmpty ? '—' : val}
              </td>
            </tr>
          `;
      }).join('')
      : '<tr><td colspan="2" style="color:#94a3b8;font-size:0.8rem;">No specs extracted</td></tr>';

    const card = document.createElement('div');
    card.className = 'amazon-preview-card preview-expanded';
    card.innerHTML = `
      <div class="preview-card-header">
        ${p.image
        ? `<img src="${p.image}" alt="${p.name}" class="amazon-thumb" onerror="this.style.display='none'" />`
        : '<div class="amazon-thumb-placeholder">📦</div>'}
        <div class="amazon-card-info">
          <div class="amazon-card-name">${p.name} ${sourceBadge}</div>
          <div class="amazon-card-meta">
            ${p.price ? `<span class="amazon-price">₹${p.price.toLocaleString('en-IN')}</span>` : '<span style="color:#94a3b8;font-size:0.82rem;">Price not found</span>'}
            ${p.rating ? `<span class="amazon-rating">★ ${p.rating}${p.reviewCount ? ` (${p.reviewCount.toLocaleString('en-IN')} reviews)` : ''}</span>` : ''}
          </div>
          <a href="${p.url}" target="_blank" rel="noopener" class="preview-url-link">
            View on ${p.source === 'croma' ? 'Croma' : 'Reliance Digital'} ↗
          </a>
        </div>
      </div>

      <div class="preview-specs-section">
        <div class="preview-specs-title">
          📊 Extracted Specs
          <span class="specs-count">${criteria ? criteria.length : 0} criteria</span>
        </div>
        <table class="preview-specs-table">
          <tbody>
            ${specRows}
          </tbody>
        </table>
        ${criteria && criteria.some(c => productRow[c] === null || productRow[c] === undefined)
        ? `<div class="missing-specs-note">
              ⚠️ Missing values will use the column average in the algorithm.
              You can also set them manually in the next step.
            </div>`
        : ''}
      </div>
    `;
    container.appendChild(card);
  });

  // ── Failures ──────────────────────────────────────────────────────────────
  if (data.failures?.length > 0) {
    const fb = document.getElementById('smart-failures-block');
    fb.classList.remove('hidden');
    fb.innerHTML = `
      <div class="warning-alert">
        ⚠️ ${data.failures.length} URL(s) could not be fetched:
        ${data.failures.map(f => `<div style="font-size:0.82rem;margin-top:4px;">${f.url || ''} — ${f.reason}</div>`).join('')}
      </div>
    `;
  }

  // ── Console debug log (development aid) ───────────────────────────────────
  console.group('[SmartCompare] Scraped Data Debug');
  console.log('Products:', products.map(p => p.name));
  console.log('Criteria:', criteria);
  console.log('Products Data Matrix:', products_data);
  console.log('Suggestions from AI:', data.suggestions);
  console.groupEnd();
}

function showSmartIdeals() {
  const { criteria, criteriaTypes, suggestions, identicalCriteria } = smartState.scrapeResult || {};
  const container = document.getElementById('smart-ideals-container');
  container.innerHTML = '';

  if (!criteria || criteria.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:#64748b;">
        <p>⚠️ No comparable specs were found automatically.</p>
        <p style="font-size:0.85rem;margin-top:8px;">
          You can still run the comparison — just fill in the values below manually.
        </p>
      </div>
    `;
    return;
  }

  const identicalSet = new Set(identicalCriteria || []);

  // Add legend
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;gap:16px;font-size:0.78rem;color:#64748b;margin-bottom:16px;flex-wrap:wrap;';
  legend.innerHTML = `
    <span>🟢 Selected — values differ (meaningful to compare)</span>
    <span>⬜ Deselected — tap to re-include</span>
    <span style="opacity:0.5">🔘 Identical across all products — excluded automatically</span>
  `;
  container.appendChild(legend);

  window.toggleSmartRow = (idx) => {
    const row = document.getElementById('smart-row-' + idx);
    const btn = document.getElementById('smart-toggle-' + idx);
    if (!row || row.dataset.identical === 'true') return;
    const isRemoved = row.dataset.removed === 'true';
    row.dataset.removed = isRemoved ? 'false' : 'true';
    // Toggle only the inputs div, not the whole row
    const inputs = row.querySelector('.amazon-ideal-inputs');
    const reasoning = row.querySelector('.amazon-ideal-reasoning');
    if (inputs) inputs.style.display = isRemoved ? '' : 'none';
    if (reasoning) reasoning.style.display = isRemoved ? '' : 'none';
    btn.textContent = isRemoved ? '🟢' : '⬜';
    row.style.opacity = isRemoved ? '1' : '0.5';
    row.style.background = isRemoved ? '' : '#f8fafc';
  };

  window.handleTypeChange = (idx) => {
    const typeSelect = document.getElementById('smart-type-' + idx);
    const idealInput = document.getElementById('smart-ideal-' + idx);
    const dirSelect = document.getElementById('smart-direction-' + idx);
    if (typeSelect.value === 'review') {
      idealInput.type = 'text';
      idealInput.placeholder = 'e.g. Good for gaming';
      dirSelect.parentElement.style.display = 'none';
    } else {
      idealInput.type = 'number';
      idealInput.placeholder = typeSelect.value === 'scale' ? '1-10' : 'Numeric value';
      dirSelect.parentElement.style.display = 'flex';
      if (typeSelect.value === 'scale') {
        idealInput.min = 1; idealInput.max = 10;
      } else {
        idealInput.removeAttribute('min'); idealInput.removeAttribute('max');
      }
    }
  };

  criteria.forEach((criterion, idx) => {
    const s = (suggestions && suggestions[criterion]) || {};
    let suggestedType = criteriaTypes?.[criterion] || 'numeric';
    const defaultDir = criterion.toLowerCase().includes('price') ? 'lower' : 'higher';
    const dir = s.direction || defaultDir;
    const idealVal = s.ideal !== undefined && s.ideal !== null ? s.ideal : '';
    const isIdentical = identicalSet.has(criterion);

    const row = document.createElement('div');
    row.className = 'amazon-ideal-row' + (isIdentical ? ' criteria-row-identical' : '');
    row.id = `smart-row-${idx}`;
    row.dataset.criterion = criterion;
    row.dataset.removed = isIdentical ? 'true' : 'false';
    row.dataset.identical = isIdentical ? 'true' : 'false';

    const { products_data } = smartState.scrapeResult;
    const sampleVal = isIdentical
      ? Object.values(products_data)[0]?.[criterion]
      : null;

    row.innerHTML = `
      <div class="amazon-ideal-header">
        <button class="criteria-toggle-btn" id="smart-toggle-${idx}"
          onclick="toggleSmartRow(${idx})"
          title="${isIdentical ? 'All products identical — excluded' : 'Toggle criterion'}"
          style="font-size:1.1rem;background:none;border:none;cursor:${isIdentical ? 'default' : 'pointer'};padding:0 6px 0 0;">
          ${isIdentical ? '🔘' : '🟢'}
        </button>
        <span class="amazon-ideal-name" style="${isIdentical ? 'opacity:0.45' : ''}">${criterion}</span>
        ${isIdentical ? `<span style="font-size:0.75rem;color:#94a3b8;margin-left:8px;">All same: ${sampleVal ?? '—'}</span>` : `
        <select class="criteria-type-select" id="smart-type-${idx}" onchange="handleTypeChange(${idx})">
          <option value="numeric" ${suggestedType === 'numeric' ? 'selected' : ''}>Numeric</option>
          <option value="scale" ${suggestedType === 'scale' ? 'selected' : ''}>Scale (1-10)</option>
          <option value="review" ${suggestedType === 'review' ? 'selected' : ''}>Review (Text)</option>
        </select>`}
      </div>
      ${!isIdentical ? `
      <div class="amazon-ideal-reasoning" style="font-size:0.8rem;color:#64748b;margin-bottom:8px;">
        ${s.reasoning || (idealVal === '' && suggestedType !== 'review' ? '⚠️ Not found — enter manually' : 'Qualitative evaluation')}
      </div>
      <div class="amazon-ideal-inputs">
        <div class="form-group">
          <label>Ideal Value:</label>
          <input type="${suggestedType === 'review' ? 'text' : 'number'}"
                 id="smart-ideal-${idx}" value="${idealVal}" step="any"
                 placeholder="${suggestedType === 'review' ? 'e.g. Good for gaming' : 'Enter manually'}" />
        </div>
        <div class="form-group">
          <label>Importance (1–5):</label>
          <input type="number" id="smart-weight-${idx}" value="${s.weight ?? 3}" min="1" max="5" />
        </div>
        <div class="form-group" style="display: ${suggestedType === 'review' ? 'none' : 'flex'}">
          <label>Better When:</label>
          <select id="smart-direction-${idx}">
            <option value="lower" ${dir === 'lower' ? 'selected' : ''}>Lower is better</option>
            <option value="higher" ${dir === 'higher' ? 'selected' : ''}>Higher is better</option>
          </select>
        </div>
      </div>` : ''}
    `;
    container.appendChild(row);
  });
}

// Collects active criteria config from the ideals UI — shared by run + approval
function _collectSmartCriteriaConfig() {
  const { criteria } = smartState.scrapeResult;
  const activeCriteria = [], ideals = [], weights = [], directions = [], featureTypes = [];

  for (let i = 0; i < criteria.length; i++) {
    const row = document.getElementById(`smart-row-${i}`);
    if (!row || row.dataset.removed === 'true' || row.dataset.identical === 'true') continue;

    const criterion = criteria[i];
    const type = document.getElementById(`smart-type-${i}`).value;
    const rawIdeal = document.getElementById(`smart-ideal-${i}`).value;
    const weight = parseFloat(document.getElementById(`smart-weight-${i}`).value);
    const direction = document.getElementById(`smart-direction-${i}`).value;

    if (type !== 'review' && isNaN(parseFloat(rawIdeal))) {
      alert(`⚠️ Enter ideal value for "${criterion}"`); return null;
    }
    if (isNaN(weight) || weight <= 0) { alert(`⚠️ Importance for "${criterion}" must be positive.`); return null; }

    activeCriteria.push(criterion);
    featureTypes.push(type);
    ideals.push(type === 'review' ? rawIdeal : parseFloat(rawIdeal));
    weights.push(weight);
    directions.push(type === 'review' ? 'True' : (direction === 'higher' ? 'True' : 'False'));
  }
  return { activeCriteria, ideals, weights, directions, featureTypes };
}

async function runSmartCalculation() {
  const config = _collectSmartCriteriaConfig();
  if (!config) return;
  const { activeCriteria, ideals, weights, directions, featureTypes } = config;
  const { products_data } = smartState.scrapeResult;

  const hasReview = featureTypes.includes('review');

  if (hasReview) {
    // Build products_data slice for review criteria only
    const reviewCriteria = activeCriteria.filter((_, i) => featureTypes[i] === 'review');
    const toScore = {};
    Object.keys(products_data).forEach(pName => {
      toScore[pName] = {};
      reviewCriteria.forEach(c => { toScore[pName][c] = products_data[pName][c] ?? 'N/A'; });
    });

    // Build ideals map for review features
    const idealsMap = {};
    activeCriteria.forEach((c, i) => {
      if (featureTypes[i] === 'review') idealsMap[c] = ideals[i];
    });

    showLoading(1);
    try {
      const response = await fetch('/api/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products_data: toScore,
          features: reviewCriteria,
          feature_types: reviewCriteria.map(() => 'review'),
          weights_raw: reviewCriteria.map((c) => weights[activeCriteria.indexOf(c)]),
          ideals: reviewCriteria.map((c) => idealsMap[c]),
          directions: reviewCriteria.map(() => 'True'),
        }),
      });

      if (!response.ok) throw new Error('Preprocessing failed');
      const preprocessed = await response.json();

      // Stash context so approval stage can call _finishSmartCalculation
      smartState.pendingCalc = { activeCriteria, ideals, weights, directions, featureTypes, preprocessed };

      // Show Step 4.5 using the manual compare approval UI
      // We temporarily override state so showApprovalStage works
      state.featureNames = activeCriteria;
      state.featureTypes = featureTypes;
      state.ideals = ideals;
      state.rawProductInputs = {};
      Object.keys(toScore).forEach(pName => {
        state.rawProductInputs[pName] = {};
        reviewCriteria.forEach(c => { state.rawProductInputs[pName][c] = toScore[pName][c]; });
      });
      pendingPreprocessed = preprocessed;

      hideLoading();
      // Show approval inside the smart tab
      const approvalContainer = document.getElementById('approval-container');
      showApprovalStage(preprocessed);
      // Move approval step into smart tab visually
      document.getElementById('step-approval').classList.add('smart-approval-mode');
      // Override confirm button to call smart finish
      document.querySelector('#step-approval .btn-primary').onclick = _confirmSmartApproval;
      // Hide all smart steps, show approval in smart tab context
      document.querySelectorAll('#tab-smart .step').forEach(s => s.classList.remove('active'));
      // Move #step-approval into smart tab temporarily
      const approvalEl = document.getElementById('step-approval');
      document.querySelector('#tab-smart .container').appendChild(approvalEl);
      approvalEl.classList.add('active');
      // Also ensure manual tab stays hidden
      document.getElementById('tab-manual').classList.add('hidden');
    } catch (e) {
      hideLoading();
      alert('❌ ' + e.message);
    }
    return;
  }

  // No review criteria — go straight to calculate
  await _finishSmartCalculation(activeCriteria, ideals, weights, directions, products_data, null);
}

async function _confirmSmartApproval() {
  const { activeCriteria, ideals, weights, directions, featureTypes, preprocessed } = smartState.pendingCalc;
  const { products_data } = smartState.scrapeResult;

  // Apply any overrides from the approval table into scored_data
  const scored_data = preprocessed.scored_data;
  const reviewCriteria = activeCriteria.filter((_, i) => featureTypes[i] === 'review');
  reviewCriteria.forEach(c => {
    const fi = activeCriteria.indexOf(c);
    Object.keys(scored_data).forEach(pName => {
      const sel = document.getElementById(`override-${pName}-${fi}`);
      if (sel && sel.value) {
        const SCALE_MAP = { "Excellent": 10, "Very Good": 9, "Good": 8, "Above Average": 7, "Average": 6, "Below Average": 5, "Poor": 4 };
        if (SCALE_MAP[sel.value] !== undefined) scored_data[pName][c] = SCALE_MAP[sel.value];
      }
    });
  });

  // Merge scored review values back into products_data
  const merged = {};
  Object.keys(products_data).forEach(pName => {
    merged[pName] = { ...products_data[pName], ...(scored_data[pName] || {}) };
  });

  await _finishSmartCalculation(activeCriteria, ideals, weights, directions, merged, preprocessed.metadata);
}

async function _finishSmartCalculation(activeCriteria, ideals, weights, directions, products_data, metadata) {
  // Build clean numeric data matrix
  const cleanData = {};
  for (const [product, vals] of Object.entries(products_data)) {
    cleanData[product] = {};
    activeCriteria.forEach((c) => {
      const raw = parseFloat(vals[c]);
      if (!isNaN(raw)) {
        cleanData[product][c] = raw;
      } else {
        const colVals = Object.values(products_data).map(v => parseFloat(v[c])).filter(n => !isNaN(n));
        cleanData[product][c] = colVals.length ? colVals.reduce((a, b) => a + b, 0) / colVals.length : 5;
      }
    });
  }

  showLoading(2);
  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products_data: cleanData,
        features: activeCriteria,
        weights_raw: weights,
        ideals: ideals.map(v => typeof v === 'string' ? 10 : v),
        directions,
        metadata: metadata || null,
      }),
    });

    if (!res.ok) throw new Error('Calculation failed');
    const result = await res.json();
    hideLoading();

    // Render results into smart tab
    const main = document.getElementById('results-container');
    const smartContainer = document.getElementById('smart-results-container');
    main.id = '__hidden';
    smartContainer.id = 'results-container';

    state.featureNames = activeCriteria;
    state.ideals = ideals.map(v => typeof v === 'string' ? 10 : v);
    displayResults(result);

    smartContainer.id = 'smart-results-container';
    main.id = 'results-container';

    showAmazonStep('step-smart-final');
  } catch (e) {
    hideLoading();
    alert('⚠️ ' + e.message);
  }

  // Move approval step back to manual tab
  const approvalEl = document.getElementById('step-approval');
  const manualContainer = document.querySelector('#tab-manual.container');
  if (manualContainer && approvalEl.parentElement !== manualContainer) {
    manualContainer.appendChild(approvalEl);
    approvalEl.classList.remove('active');
  }
}

function showAmazonStep(stepId) {
  document.querySelectorAll('#tab-smart .step').forEach((s) => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
  if (stepId === 'step-smart-ideals') showSmartIdeals();
}

function resetSmart() {
  smartState = { query: '', searchResults: [], selectedUrls: [], scrapeResult: null, pendingCalc: null };
  document.getElementById('smart-query-input').value = '';
  document.getElementById('smart-suggestions').classList.add('hidden');
  document.getElementById('smart-template').classList.add('hidden');
  document.getElementById('smart-search-error').classList.add('hidden');
  document.getElementById('smart-failures-block').classList.add('hidden');
  document.getElementById('smart-preview-cards').innerHTML = '';
  document.getElementById('smart-ideals-container').innerHTML = '';
  document.getElementById('smart-results-container').innerHTML = '';
  // Ensure tab visibility is correct
  switchTab('smart');
  showAmazonStep('step-smart-search');
}
