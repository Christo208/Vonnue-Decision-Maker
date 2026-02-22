// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const { calculateDecision, generateExplanation, build4Styles } = require("./decisionLogic");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

app.post("/api/calculate", async (req, res) => {
  try {
    const { products_data, features, weights_raw, ideals, directions } = req.body;

    const result = calculateDecision(products_data, features, weights_raw, ideals, directions);
    
    // Generate AI explanation (or fallback)
    const { explanation, source } = await generateExplanation(result, features);
    
    // Generate all 4 template styles
    const styles = build4Styles(result, features);

    res.json({
      ...result,
      explanation,
      explanation_source: source,
      explanation_styles: styles
    });

  } catch (error) {
    console.error("Calculation error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
