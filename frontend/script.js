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
