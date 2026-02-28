require("dotenv").config();
const { extractScoreFromText } = require('./decisionLogic');

async function runTest(label, text, feature, ideal) {
    process.stdout.write(`\nTest: ${label}\n  Review:  "${text}"\n  Ideal:   "${ideal}"\n  `);
    try {
        const result = await extractScoreFromText(text, feature, ideal);
        console.log(`→ Score: ${result.score}/10  Confidence: ${result.confidence}  Source: ${result.source}`);
    } catch (e) {
        console.log(`→ ERROR: ${e.message}`);
    }
}

(async () => {
    console.log("=== Live API scoring tests ===\n");

    // Should score LOW (2-3) + high confidence
    await runTest("Clearly bad match", "Loud party scene", "Vibe", "Relaxing and quiet");

    // Should score HIGH (8-9) + high confidence  
    await runTest("Clearly good match", "Very peaceful atmosphere, serene and calm", "Vibe", "Relaxing and quiet");

    // Should score MID (4-6) + medium confidence
    await runTest("Partial match", "Mostly quiet but sometimes noisy on weekends", "Vibe", "Relaxing and quiet");

    // Should score LOW (1) + low confidence (off-topic)
    await runTest("Trash/irrelevant", "The Taj Mahal is white", "Vibe", "Relaxing and quiet");

    console.log("\n=== Done ===");
    process.exit(0);
})();
