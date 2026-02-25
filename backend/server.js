// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
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

    res.json({
      scored_data,
      scored_ideals,
      metadata,
      ai_failures,
      // Pass through for the final /api/calculate call
      features,
      weights_raw,
      directions,
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
