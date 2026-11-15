// Gold (24K) and silver (999) prices per gram in rupees, read from bullions.co.in, kept 15 minutes
const METALS_CACHE_TTL = 15 * 60 * 1000;
let _metalsCache = { data: null, timestamp: null };

async function fetchMetalSpotPricesINR() {
    const now = Date.now();
    if (_metalsCache.data && _metalsCache.timestamp && now - _metalsCache.timestamp < METALS_CACHE_TTL) {
        return _metalsCache.data;
    }

    const res = await fetch('https://bullions.co.in/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; portfolio-tracker/1.0)',
            'Accept': 'text/html',
        },
    });
    if (!res.ok) throw new Error(`bullions.co.in HTTP ${res.status}`);
    const html = await res.text();

    // Primary: table row - label cell contains <small> tag, so use lazy [\s\S]*? to pass through it
    // HTML: <td …>Gold 24 Karat <small>(Rs …)</small></td> <td …>15,681</td>
    const goldTableMatch = html.match(/Gold\s+24\s+Karat[\s\S]*?<\/td>\s*<td[^>]*>([\d,]+)/i);
    // HTML: <td …>Silver 999 Fine <small>(Rs …)</small></td> <td …>268</td>
    const silverTableMatch = html.match(/Silver\s+999\s+Fine[\s\S]*?<\/td>\s*<td[^>]*>([\d,]+)/i);

    // Fallback: ticker "GOLD 156,810.00 … / 10gm" and "SILVER 267,790.00 … / 1kg"
    const goldTickerMatch = html.match(/GOLD\s+([\d,]+(?:\.\d+)?)\s/);
    const silverTickerMatch = html.match(/SILVER\s+([\d,]+(?:\.\d+)?)\s/);

    let goldPerGram, silverPerGram;

    if (goldTableMatch) {
        goldPerGram = parseFloat(goldTableMatch[1].replace(/,/g, ''));
    } else if (goldTickerMatch) {
        goldPerGram = parseFloat(goldTickerMatch[1].replace(/,/g, '')) / 10; // per 10g → per g
    } else {
        throw new Error('Could not parse gold price from bullions.co.in');
    }

    if (silverTableMatch) {
        silverPerGram = parseFloat(silverTableMatch[1].replace(/,/g, ''));
    } else if (silverTickerMatch) {
        silverPerGram = parseFloat(silverTickerMatch[1].replace(/,/g, '')) / 1000; // per kg → per g
    } else {
        throw new Error('Could not parse silver price from bullions.co.in');
    }

    if (!goldPerGram || goldPerGram <= 0) throw new Error('Invalid gold price from bullions.co.in');
    if (!silverPerGram || silverPerGram <= 0) throw new Error('Invalid silver price from bullions.co.in');

    const result = {
        gold: { pricePerGram: goldPerGram },
        silver: { pricePerGram: silverPerGram },
        fetchedAt: new Date().toISOString(),
        source: 'bullions.co.in',
    };
    _metalsCache = { data: result, timestamp: now };
    return result;
}

module.exports = { fetchMetalSpotPricesINR };
