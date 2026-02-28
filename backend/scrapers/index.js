// scrapers/index.js
// Routes a URL to the correct scraper based on domain.

const { scrapeCroma, normaliseCromaUrl } = require('./cromaScraper');
const { scrapeReliance, normaliseRelianceUrl } = require('./relianceScraper');

function detectSource(url) {
    if (url.includes('croma.com')) return 'croma';
    if (url.includes('reliancedigital.in')) return 'reliance';
    return null;
}

async function scrapeProduct(url) {
    const source = detectSource(url);
    if (!source) {
        throw new Error(
            `Unsupported URL. Paste a croma.com or reliancedigital.in product URL.`
        );
    }
    if (source === 'croma') return scrapeCroma(url);
    if (source === 'reliance') return scrapeReliance(url);
}

async function scrapeProducts(urls) {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const results = [];

    for (let i = 0; i < urls.length; i++) {
        try {
            const data = await scrapeProduct(urls[i]);
            results.push({ success: true, data });
        } catch (e) {
            results.push({ success: false, url: urls[i], error: e.message });
        }
        if (i < urls.length - 1) await delay(600);
    }

    return results;
}

module.exports = { scrapeProducts, detectSource };
