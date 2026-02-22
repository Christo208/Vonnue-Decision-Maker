// script.js - Frontend logic and UI interactions

// Global state
let state = {
    numProducts: 0,
    numFeatures: 0,
    featureNames: [],
    featureWeights: [],
    featureDirections: [],
    products: {},
    ideals: []
};
let currentStyleIndex = 0;
let allStyles = null;
const styleNames = ['data', 'story', 'compare', 'action'];
const styleLabels = ['📊 Data-Driven', '📖 Storytelling', '⚖️ Comparative', '⚡ Actionable'];

// Step 1: Initialize setup
function startSetup() {
    const numProducts = parseInt(document.getElementById('num-products').value);
    const numFeatures = parseInt(document.getElementById('num-features').value);
    
    // Validation
    if (numProducts < 2) {
        alert('⚠️ Please enter at least 2 options to compare.');
        return;
    }
    
    if (numFeatures < 1) {
        alert('⚠️ Please enter at least 1 criterion.');
        return;
    }
    
    state.numProducts = numProducts;
    state.numFeatures = numFeatures;
    
    // Generate features form
    generateFeaturesForm();
    showStep('step-features');
}

// Generate features input form
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
        `;
        container.appendChild(featureDiv);
    }
}

// Go to products step
function goToProducts() {
    // Collect feature data
    state.featureNames = [];
    state.featureWeights = [];
    state.featureDirections = [];
    
    for (let i = 0; i < state.numFeatures; i++) {
        const name = document.getElementById(`feature-name-${i}`).value.trim();
        const weight = parseFloat(document.getElementById(`feature-weight-${i}`).value);
        const direction = document.getElementById(`feature-direction-${i}`).value;
        
        // Validation
        if (!name) {
            alert(`⚠️ Please enter a name for Criterion ${i + 1}`);
            return;
        }
        
        if (state.featureNames.includes(name)) {
            alert(`⚠️ Criterion name "${name}" is already used. Please choose a unique name.`);
            return;
        }
        
        if (weight <= 0) {
            alert(`⚠️ Importance for "${name}" must be positive.`);
            return;
        }
        
        state.featureNames.push(name);
        state.featureWeights.push(weight);
        state.featureDirections.push(direction);
    }
    
    // Generate products form
    generateProductsForm();
    showStep('step-products');
}

// Generate products input form
function generateProductsForm() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    
    for (let i = 0; i < state.numProducts; i++) {
        const productDiv = document.createElement('div');
        productDiv.className = 'product-section';
        
        let featuresHTML = '';
        state.featureNames.forEach((feature, idx) => {
            featuresHTML += `
                <div class="form-group">
                    <label>${feature}:</label>
                    <input type="number" id="product-${i}-feature-${idx}" step="any" required>
                </div>
            `;
        });
        
        productDiv.innerHTML = `
            <h3>Option ${i + 1}</h3>
            <div class="form-group">
                <label>Option Name:</label>
                <input type="text" id="product-name-${i}" placeholder="e.g., Product A" required>
            </div>
            ${featuresHTML}
        `;
        container.appendChild(productDiv);
    }
}

// Go to ideals step
function goToIdeals() {
    // Collect product data
    state.products = {};
    
    for (let i = 0; i < state.numProducts; i++) {
        const productName = document.getElementById(`product-name-${i}`).value.trim();
        
        // Validation
        if (!productName) {
            alert(`⚠️ Please enter a name for Option ${i + 1}`);
            return;
        }
        
        if (state.products[productName]) {
            alert(`⚠️ Option name "${productName}" is already used. Please choose a unique name.`);
            return;
        }
        
        state.products[productName] = {};
        
        state.featureNames.forEach((feature, idx) => {
            const value = parseFloat(document.getElementById(`product-${i}-feature-${idx}`).value);
            state.products[productName][feature] = value;
        });
    }
    
    // Generate ideals form
    generateIdealsForm();
    showStep('step-ideals');
}

// Generate ideals input form
function generateIdealsForm() {
    const container = document.getElementById('ideals-container');
    container.innerHTML = '<p class="hint">Enter your ideal/target value for each criterion:</p>';
    
    state.featureNames.forEach((feature, idx) => {
        const idealDiv = document.createElement('div');
        idealDiv.className = 'form-group';
        idealDiv.innerHTML = `
            <label>Ideal ${feature}:</label>
            <input type="number" id="ideal-${idx}" step="any" required>
            <span class="hint">Your target or desired value for ${feature}</span>
        `;
        container.appendChild(idealDiv);
    });
}

// Calculate and display results
async function calculateResult() {
    // Collect ideal values
    state.ideals = [];
    
    for (let i = 0; i < state.numFeatures; i++) {
        const ideal = parseFloat(document.getElementById(`ideal-${i}`).value);
        state.ideals.push(ideal);
    }
    
    // Prepare data for API
    const requestData = {
        products_data: state.products,
        features: state.featureNames,
        weights_raw: state.featureWeights,
        ideals: state.ideals,
        directions: state.featureDirections
    };
    
    try {
        // Call backend API
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error('Calculation failed');
        }
        
        const result = await response.json();
        
        // Display results
        displayResults(result);
        showStep('step-results');
        
    } catch (error) {
        alert('❌ Error calculating decision: ' + error.message);
    }
}

// Display results
function displayResults(result) {
    const container = document.getElementById('results-container');
    
    // Store styles for refresh button
    allStyles = result.explanation_styles || null;
    currentStyleIndex = 0;
    
    let html = '';
    
    // Winner/Tie (same as before)
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
    
    // EXPLANATION CARD with REFRESH button
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

    // Ranking
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
    
    // Detailed breakdown
    html += `
        <div class="breakdown-section">
            <h3>🔍 Detailed Breakdown</h3>
            ${Object.keys(result.detailed_breakdown).map(product => `
                <div class="breakdown-product">
                    <h4>${product} (Total: ${result.agg_sum[product].toFixed(2)} points)</h4>
                    ${state.featureNames.map((feature, idx) => {
                        const breakdown = result.detailed_breakdown[product][feature];
                        return `
                            <div class="breakdown-row">
                                <span>${feature}:</span>
                                <span>
                                    Penalty: ${breakdown.penalty.toFixed(2)} × 
                                    Weight: ${(breakdown.weight * 100).toFixed(1)}% = 
                                    ${breakdown.weighted_penalty.toFixed(2)} points
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

// Navigation functions
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(stepId).classList.add('active');
}

function goBack(stepId) {
    showStep(stepId);
}

function resetForm() {
    state = {
        numProducts: 0,
        numFeatures: 0,
        featureNames: [],
        featureWeights: [],
        featureDirections: [],
        products: {},
        ideals: []
    };
    showStep('step-setup');
}
