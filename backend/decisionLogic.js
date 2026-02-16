// decisionLogic.js - Core decision-making algorithm
// Converted from Python, using same variable names

function calculateDecision(products_data, f_list, rate_list, req_list, high_or_low) {
    /*
    products_data: object like {
        'Apple': {'Price': 50000, 'Battery': 4000},
        'Samsung': {'Price': 45000, 'Battery': 5000}
    }
    f_list: array like ['Price', 'Battery']
    rate_list: array like [5, 4]
    req_list: array like [45000, 6000]
    high_or_low: array like ['False', 'True']
    
    Returns: {
        winner: string,
        ranking: array,
        agg_sum: object,
        detailed_breakdown: object,
        tie: array
    }
    */
    
    // Calculate weights (normalize rate_list to sum to 1)
    const total = rate_list.reduce((sum, rate) => sum + rate, 0);
    const weights = rate_list.map(rate => rate / total);
    
    // Deep copy products_data to avoid mutation
    let d = JSON.parse(JSON.stringify(products_data));
    
    // Compute min/max per feature
    const min_max = {};
    for (let feature of f_list) {
        const values = Object.keys(d).map(p => d[p][feature]);
        const min_v = Math.min(...values);
        const max_v = Math.max(...values);
        min_max[feature] = { min: min_v, max: max_v };
    }
    
    // Normalize product values
    for (let feature of f_list) {
        const { min: min_v, max: max_v } = min_max[feature];
        for (let p in d) {
            if (max_v === min_v) {
                d[p][feature] = 50.0;  // neutral value
            } else {
                d[p][feature] = (d[p][feature] - min_v) / (max_v - min_v) * 100;
            }
        }
    }
    
    // Normalize ideal values
    const norm_req_list = [];
    for (let i = 0; i < f_list.length; i++) {
        const feature = f_list[i];
        const { min: min_v, max: max_v } = min_max[feature];
        const ideal = req_list[i];
        
        let norm_ideal;
        if (max_v === min_v) {
            norm_ideal = 50.0;
        } else {
            norm_ideal = (ideal - min_v) / (max_v - min_v) * 100;
        }
        norm_req_list.push(norm_ideal);
    }
    
    // Calculate penalties and aggregate scores
    const agg_sum = {};
    const detailed_breakdown = {};
    
    for (let i in d) {
        let tsum = 0;
        detailed_breakdown[i] = {};
        
        for (let x = 0; x < f_list.length; x++) {
            const y = f_list[x];
            let penalty;
            
            if (high_or_low[x] === "True") {  // higher is better
                penalty = Math.max(0, norm_req_list[x] - d[i][y]);
            } else {  // lower is better
                penalty = Math.max(0, d[i][y] - norm_req_list[x]);
            }
            
            d[i][y] = penalty;
            const weighted_penalty = penalty * weights[x];
            tsum += weighted_penalty;
            
            // Store detailed breakdown
            detailed_breakdown[i][y] = {
                penalty: penalty,
                weight: weights[x],
                weighted_penalty: weighted_penalty
            };
        }
        
        agg_sum[i] = tsum;
    }
    
    // Find minimum score and detect ties
    const mvp_score = Math.min(...Object.values(agg_sum));
    const tie = [];
    
    // Create ranking
    const ranking = Object.entries(agg_sum)
        .sort((a, b) => a[1] - b[1])
        .map(([product, score], index) => {
            if (Math.abs(score - mvp_score) < 0.001) {
                tie.push(product);
            }
            return {
                rank: index + 1,
                product: product,
                score: score
            };
        });
    
    // Return results
    return {
        winner: tie.length === 1 ? tie[0] : null,
        tie: tie,
        ranking: ranking,
        agg_sum: agg_sum,
        detailed_breakdown: detailed_breakdown,
        weights: weights,
        features: f_list
    };
}

// Export function
module.exports = { calculateDecision };