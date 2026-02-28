// cromaScraper.js
// Scrapes croma.com product pages.
//
// STRATEGY: Croma is protected by Akamai CDN (403 on direct requests).
// We use best-effort extraction from what IS available:
// - Product name: from URL slug (very reliable) + OG meta fallback
// - Price / specs: Croma embeds their product data as a Next.js / Hybris
//   JSON payload in a <script id="__NEXT_DATA__"> or similar block.
//   We extract it with regex and parse what we can.
// - Image: from OG meta (if not blocked)
//
// Any field returning null can be manually entered in the Priorities step.

const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
    // Croma-specific headers to reduce chance of 403
    'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'Upgrade-Insecure-Requests': '1',
};

function normaliseCromaUrl(url) {
    try {
        const u = new URL(url.trim());
        if (!u.hostname.includes('croma.com')) {
            throw new Error('Not a croma.com URL');
        }
        return { url: `https://www.croma.com${u.pathname}`, source: 'croma' };
    } catch (e) {
        throw new Error(`Invalid Croma URL: ${url}`);
    }
}

// Extract product name from Croma URL slug
// e.g. "/lenovo-yoga-slim-7-14imh9/p/302888" → "Lenovo Yoga Slim 7 14IMH9"
function nameFromSlug(pathname) {
    const segments = pathname.split('/').filter(Boolean);
    const slug = segments.find(s => s !== 'p' && !/^\d+$/.test(s));
    if (!slug) return null;
    return slug
        .replace(/-+/g, ' ')
        .replace(/\b(\w)/g, c => c.toUpperCase())
        .trim();
}

async function scrapeCroma(rawUrl) {
    const { url } = normaliseCromaUrl(rawUrl);

    // Try with a small delay to reduce rate-limiting
    await new Promise(r => setTimeout(r, 400));

    const fetch = (await import('node-fetch')).default;
    let html = '';
    let statusCode = 0;

    try {
        const response = await fetch(url, { headers: HEADERS, timeout: 15000 });
        statusCode = response.status;

        if (statusCode === 403) {
            // Croma blocked us — extract from URL slug only
            console.log('[Croma] 403 received, falling back to slug extraction');
            html = '';
        } else if (!response.ok) {
            throw new Error(`HTTP ${response.status} from Croma`);
        } else {
            html = await response.text();
        }
    } catch (e) {
        if (!html) throw e;
    }

    // ── Product name ──────────────────────────────────────────────────────────
    let name = '';
    if (html) {
        const $ = cheerio.load(html);
        name =
            $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('h1').first().text().trim() ||
            $('title').text().trim();

        name = name
            .replace(/\s*[-|]\s*(Croma|Buy Online|Online Shopping|India).*/i, '')
            .trim();
    }

    // Slug fallback — very reliable for Croma (clean URL structure)
    // Trigger if name is generic/blocked (Akamai returns generic HTML on 403)
    const isGeneric = !name ||
        name.toLowerCase().includes('access denied') ||
        name.toLowerCase().includes('croma electronics') ||
        name.toLowerCase().includes('online electronics shopping') ||
        name.length < 4;
    if (isGeneric) {
        name = nameFromSlug(new URL(url).pathname) || 'Unknown Product';
    }
    // ── Image ─────────────────────────────────────────────────────────────────
    let image = null;
    if (html) {
        const $ = cheerio.load(html);
        image = $('meta[property="og:image"]').attr('content') || null;
        if (image && (image.includes('logo') || image.includes('Logo'))) image = null;
    }

    // ── Price ─────────────────────────────────────────────────────────────────
    let price = null;
    if (html) {
        // Try JSON-LD first
        const $ = cheerio.load(html);
        $('script[type="application/ld+json"]').each((_, el) => {
            if (price !== null) return;
            try {
                const data = JSON.parse($(el).html());
                const prod = data['@type'] === 'Product' ? data :
                    (Array.isArray(data['@graph']) ? data['@graph'].find(x => x['@type'] === 'Product') : null);
                if (prod?.offers?.price) price = parseFloat(prod.offers.price);
                else if (prod?.offers?.lowPrice) price = parseFloat(prod.offers.lowPrice);
            } catch (e) { /* ignore */ }
        });

        // Regex fallback for ₹ price
        if (price === null) {
            const priceMatch = html.match(/[₹]\s*([\d,]+)/);
            if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ''));
        }
        if (isNaN(price)) price = null;
    }

    // ── Rating ─────────────────────────────────────────────────────────────────
    let rating = null;
    if (html) {
        const rm = html.match(/"ratingValue"\s*:\s*([\d.]+)/) ||
            html.match(/"aggregateRating"[^}]*"ratingValue"\s*:\s*([\d.]+)/);
        if (rm) rating = parseFloat(rm[1]);
    }

    // ── Review count ─────────────────────────────────────────────────────────
    let reviewCount = null;
    if (html) {
        const rv = html.match(/"reviewCount"\s*:\s*(\d+)/);
        if (rv) reviewCount = parseInt(rv[1], 10);
    }

    // ── Specs (JSON-LD additionalProperty) ────────────────────────────────────
    const specs = {};
    if (html) {
        const $ = cheerio.load(html);
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const data = JSON.parse($(el).html());
                const prod = data['@type'] === 'Product' ? data :
                    (Array.isArray(data['@graph']) ? data['@graph'].find(x => x['@type'] === 'Product') : null);
                if (!prod) return;
                (prod.additionalProperty || []).forEach(p => {
                    if (p.name && p.value) specs[p.name] = String(p.value);
                });
            } catch (e) { /* ignore */ }
        });
    }

    return {
        name,
        price,
        rating,
        reviewCount,
        specs,
        image,
        url,
        source: 'croma',
    };
}

module.exports = { scrapeCroma, normaliseCromaUrl };
