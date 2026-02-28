// relianceSearch.js
// ─────────────────────────────────────────────────────────────────────────────
// Searches Reliance Digital's internal catalog API and returns lightweight
// product listings (name, price, image, url) — no headless browser, no auth.
//
// API CONFIRMED (browser console, 2026-02-28):
//   GET https://www.reliancedigital.in/ext/raven-api/catalog/v1.0/products
//       ?page_size=12&q={query}
//   • Works with standard User-Agent + Accept headers (same as relianceScraper.js)
//   • item.slug      → URL slug  (e.g. "asus-tuf-a15-fa506ncg-hn200ws-gaming-laptop-…")
//   • item.uid       → numeric product ID  (e.g. "9345133")
//   • item.price     → { effective: { min, max }, marked: { min, max } }
//   • item.medias    → [{ url, alt }]  (product images)
//   • item.brand     → { name }
//   • item.rating    → number | null
//
// PRODUCT URL:
//   https://www.reliancedigital.in/product/{slug}/{uid}
//
// USAGE:
//   const { searchReliance } = require('./relianceSearch');
//   const results = await searchReliance('gaming laptop', { pageSize: 12 });
//   // results → [{ name, price, image, url, brand, rating, source }, …]
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_API = 'https://www.reliancedigital.in/ext/raven-api/catalog/v1.0/products';

// Match relianceScraper.js headers exactly so both scrapers look identical
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Referer': 'https://www.reliancedigital.in/',
};

// ─── Price extraction ────────────────────────────────────────────────────────
// item.price structure (confirmed from API):
//   { effective: { min: 78990, max: 78990 }, marked: { min: 99990, max: 99990 }, … }
// We want the effective (selling) price.
function extractPrice(priceObj) {
    if (!priceObj) return null;
    const val = priceObj?.effective?.min
        ?? priceObj?.effective?.max
        ?? priceObj?.marked?.min
        ?? null;
    return (val && val > 0) ? val : null;
}

// ─── Image extraction ────────────────────────────────────────────────────────
// item.medias is an array like [{ url: "https://cdn…", alt: "…" }]
function extractImage(medias) {
    if (!Array.isArray(medias) || medias.length === 0) return null;
    const img = medias[0];
    // Prefer CDN URL, skip logos
    const url = img?.url || img?.cdn?.url || null;
    if (!url || /logo|company/i.test(url)) return null;
    return url;
}

// ─── Map a single API item → our standard product shape ─────────────────────
function mapItem(item) {
    const slug = item.slug || null;
    const uid = item.uid || item.item_code || null;

    const url = (slug && uid)
        ? `https://www.reliancedigital.in/product/${slug}`
        : null;

    // Name: item.name (top-level) is cleaner than attributes.description
    const name = item.name
        || item.attributes?.description
        || item.attributes?.name
        || 'Unknown Product';

    const price = extractPrice(item.price)
        // fallback: discount_applied stores the flat selling price
        ?? item.attributes?.discount_applied?.discount?.[0]?.value
        ?? null;

    const image = extractImage(item.medias);

    const brand = item.brand?.name || null;
    const rating = (item.rating && item.rating > 0) ? item.rating : null;

    return { name, price, image, url, brand, rating, source: 'reliance' };
}

// ─── Main search function ────────────────────────────────────────────────────
/**
 * Search Reliance Digital for products matching `query`.
 *
 * @param {string} query       — e.g. "gaming laptop", "HP Victus"
 * @param {object} [options]
 * @param {number} [options.pageSize=12]  — results per page (max ~50 practical)
 * @param {number} [options.pageNo=1]     — page number
 * @returns {Promise<Array>}   — array of product objects
 */
async function searchReliance(query, { pageSize = 12, pageNo = 1 } = {}) {
    if (!query || typeof query !== 'string' || !query.trim()) {
        throw new Error('[RelianceSearch] query must be a non-empty string');
    }

    const params = new URLSearchParams({
        q: query.trim(),
        page_size: String(pageSize),
        page_no: String(pageNo),
    });

    const apiUrl = `${SEARCH_API}?${params.toString()}`;
    console.log(`[RelianceSearch] Fetching: ${apiUrl}`);

    const fetch = (await import('node-fetch')).default;

    let response;
    try {
        response = await fetch(apiUrl, { headers: HEADERS, timeout: 15000 });
    } catch (err) {
        throw new Error(`[RelianceSearch] Network error: ${err.message}`);
    }

    if (!response.ok) {
        throw new Error(`[RelianceSearch] HTTP ${response.status} from API`);
    }

    let data;
    try {
        data = await response.json();
    } catch (err) {
        throw new Error(`[RelianceSearch] Failed to parse JSON response: ${err.message}`);
    }

    const items = data?.items;
    if (!Array.isArray(items)) {
        console.warn('[RelianceSearch] Unexpected response shape — no items array:', JSON.stringify(data).slice(0, 200));
        return [];
    }

    // Filter to type === 'product' only (API can return banners etc.)
    const products = items
        .filter(item => item.type === 'product')
        .map(mapItem)
        .filter(p => p.url); // drop anything with no constructable URL

    console.log(`[RelianceSearch] "${query}" → ${products.length} products (page ${pageNo})`);
    return products;
}

// ─── Convenience: fetch multiple pages ──────────────────────────────────────
/**
 * Fetch multiple pages and return a flat array.
 *
 * @param {string} query
 * @param {number} [totalResults=24]  — how many results you want total
 * @returns {Promise<Array>}
 */
async function searchRelianceAll(query, totalResults = 24) {
    const pageSize = 12;
    const pages = Math.ceil(totalResults / pageSize);
    const allResults = [];

    for (let page = 1; page <= pages; page++) {
        const batch = await searchReliance(query, { pageSize, pageNo: page });
        allResults.push(...batch);
        if (batch.length < pageSize) break; // no more pages
    }

    return allResults.slice(0, totalResults);
}

module.exports = { searchReliance, searchRelianceAll };
