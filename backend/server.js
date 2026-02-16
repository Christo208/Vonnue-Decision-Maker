// server.js - Node.js server to serve frontend files

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// API endpoint for decision calculation
app.post('/api/calculate', (req, res) => {
    try {
        const { products_data, features, weights_raw, ideals, directions } = req.body;
        
        // Import decision logic
        const { calculateDecision } = require('./decisionLogic');
        
        // Calculate result
        const result = calculateDecision(products_data, features, weights_raw, ideals, directions);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📂 Serving frontend from: ${path.join(__dirname, '../frontend')}`);
});