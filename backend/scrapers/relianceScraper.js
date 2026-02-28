// relianceScraper.js  —  v2
// ─────────────────────────────────────────────────────────────────────────────
// WHAT CHANGED FROM v1
//   v1: specs from JSON-LD additionalProperty only  →  always empty (Reliance
//       puts only item_group_id there, not actual specs)
//   v2: specs from <li class="specifications-list"> in the SSR HTML  →  works!
//       The full spec table IS present in the static HTML (Vue SSR renders it).
//       Cheerio can parse it directly — no headless browser needed.
//
// EXTRACTION MAP
//   Name    ← JSON-LD Product.name  (most detailed, e.g. "Whirlpool 7kg …")
//   Price   ← JSON-LD Product.offers.price  (clean integer string, reliable)
//   Rating  ← JSON-LD aggregateRating.ratingValue  (0 means no reviews yet)
//   Image   ← JSON-LD Product.image  (CDN URL, always present)
//   Specs   ← <li class="specifications-list"> pairs  (32 fields typically)
//             Key = first <span>, Value = <ul> text inside second <span>
// ─────────────────────────────────────────────────────────────────────────────

const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept-Encoding': 'identity',   // no compression — easier to parse
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
};

// ─── URL normalisation ───────────────────────────────────────────────────────
function normaliseRelianceUrl(url) {
    try {
        const u = new URL(url.trim());
        if (!u.hostname.includes('reliancedigital.in')) {
            throw new Error('Not a reliancedigital.in URL');
        }
        return { url: `https://www.reliancedigital.in${u.pathname}`, source: 'reliance' };
    } catch (e) {
        throw new Error(`Invalid Reliance Digital URL: ${url}`);
    }
}

// ─── Slug fallback name ──────────────────────────────────────────────────────
function nameFromSlug(pathname) {
    const segments = pathname.split('/').filter(Boolean);
    const slug = segments.find(s => s !== 'p' && !/^\d+$/.test(s));
    if (!slug) return null;
    return slug.replace(/-+/g, ' ').replace(/\b(\w)/g, c => c.toUpperCase()).trim();
}

// ─── Core scraper ────────────────────────────────────────────────────────────
async function scrapeReliance(rawUrl) {
    const { url } = normaliseRelianceUrl(rawUrl);
    console.log(`[RelianceScraper] Fetching: ${url}`);

    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, { headers: HEADERS, timeout: 20000 });

    if (!response.ok) throw new Error(`HTTP ${response.status} from Reliance Digital`);
    const html = await response.text();
    console.log(`[RelianceScraper] HTML size: ${(html.length / 1024).toFixed(1)} KB`);

    const $ = cheerio.load(html);

    // ── 1. JSON-LD Product block ────────────────────────────────────────────
    let ldProduct = null;
    $('script[type="application/ld+json"]').each((_, el) => {
        if (ldProduct) return;            // already found
        try {
            const d = JSON.parse($(el).html());
            if (d['@type'] === 'Product') ldProduct = d;
        } catch (e) { /* ignore malformed */ }
    });

    if (ldProduct) {
        console.log(`[RelianceScraper] JSON-LD Product found: "${ldProduct.name}"`);
    } else {
        console.warn('[RelianceScraper] No JSON-LD Product block found — falling back to meta/slug');
    }

    // ── 2. Name ─────────────────────────────────────────────────────────────
    // JSON-LD name is the richest: "Whirlpool 7 kg Top Load, 6th Sense, ZPF …"
    let name = ldProduct?.name || null;

    if (!name) {
        // OG title — strip Reliance boilerplate suffix
        name = $('meta[property="og:title"]').attr('content') ||
               $('meta[name="twitter:title"]').attr('content') ||
               $('title').text().trim();
        name = name
            .replace(/\s*[-|]\s*(Reliance Digital|Buy Online|Online Shopping|India).*/i, '')
            .replace(/^Buy\s+/i, '')
            .trim();
    }

    // Last resort: slug
    if (!name || name.length < 5) {
        name = nameFromSlug(new URL(url).pathname) || 'Unknown Product';
    }

    // ── 3. Price ────────────────────────────────────────────────────────────
    // JSON-LD offers.price is a clean string like "12999"
    let price = null;
    const ldPrice = ldProduct?.offers?.price;
    if (ldPrice) {
        const n = parseFloat(String(ldPrice).replace(/[^\d.]/g, ''));
        if (!isNaN(n) && n > 0) price = n;
    }

    if (price === null) {
        // Regex fallback on full HTML
        const m = html.match(/[₹]\s*([\d,]+)/);
        if (m) {
            const n = parseFloat(m[1].replace(/,/g, ''));
            if (!isNaN(n) && n > 0) price = n;
        }
    }
    console.log(`[RelianceScraper] Price: ${price}`);

    // ── 4. Rating ───────────────────────────────────────────────────────────
    const ldRating = ldProduct?.aggregateRating;
    let rating = null;
    let reviewCount = null;
    if (ldRating) {
        const rv = parseFloat(ldRating.ratingValue);
        const rc = parseInt(ldRating.ratingCount, 10);
        // ratingValue=0 with ratingCount=0 means "no reviews yet" → keep null
        if (!isNaN(rv) && rv > 0) rating = rv;
        if (!isNaN(rc) && rc > 0) reviewCount = rc;
    }
    console.log(`[RelianceScraper] Rating: ${rating}  (${reviewCount} reviews)`);

    // ── 5. Image ────────────────────────────────────────────────────────────
    let image = ldProduct?.image || null;
    if (!image) {
        image = $('meta[property="og:image"]').attr('content') || null;
    }
    // Skip logo images
    if (image && /logo|Logo|jioretailer\/company/i.test(image)) image = null;

    // ── 6. Specs — the KEY fix ───────────────────────────────────────────────
    // Structure in SSR HTML (Vue component, attr data-v-126a402a):
    //
    //   <li class="specifications-list" data-v-…>
    //     <span data-v-…>Key Name</span>
    //     <span class="specifications-list--right" data-v-…>
    //       <span data-v-…>
    //         <ul data-v-…>Value Text</ul>
    //       </span>
    //     </span>
    //   </li>
    //
    // We grab all <li class="specifications-list"> and pull key/value from the
    // first two direct child <span> elements.

    const specs = {};
    const specItems = $('li.specifications-list');
    console.log(`[RelianceScraper] Spec <li> items found: ${specItems.length}`);

    specItems.each((_, li) => {
        const children = $(li).children('span');
        if (children.length < 2) return;

        const key = $(children[0]).text().trim();
        // Value is inside the second span — could be nested in <ul>
        const valSpan = $(children[1]);
        const ulText = valSpan.find('ul').text().trim();
        const value = ulText || valSpan.text().trim();

        if (!key || !value) return;

        // Skip "See More" truncation artifacts and contact/legal boilerplate
        const skipKeys = [
            'Customer care address', 'Customer care Phone', 'Customer care email',
            'Name and address of Packer', 'Name and address of Importer',
            'Name and address of Manufacturer', 'Name and address of Marketed By',
            'Name of Seller', 'Month and Year of Commodity First Manufactured/Imported/Packed',
        ];
        if (skipKeys.includes(key)) return;

        specs[key] = value;
    });

    console.log(`[RelianceScraper] Specs extracted: ${Object.keys(specs).length} fields`);
    console.log('[RelianceScraper] Spec keys:', Object.keys(specs).join(', '));

    // ── 7. Return ────────────────────────────────────────────────────────────
    return {
        name,
        price,
        rating,
        reviewCount,
        specs,
        image,
        url,
        source: 'reliance',
    };
}

module.exports = { scrapeReliance, normaliseRelianceUrl };