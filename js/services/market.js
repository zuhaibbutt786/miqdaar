/**
 * Market Price Service — fawazahmed0/exchange-api (currency-api)
 * Gold (XAU) / Silver (XAG) are quoted as units of metal per 1 USD.
 * Price of 1 troy ounce (USD) = 1 / rate. Convert to grams and user currency.
 */

const PRIMARY = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';
const FALLBACK = 'https://latest.currency-api.pages.dev/v1';
const TROY_OZ_GRAMS = 31.1034768;

async function fetchUsdJson() {
  const urls = [
    `${PRIMARY}/currencies/usd.min.json`,
    `${PRIMARY}/currencies/usd.json`,
    `${FALLBACK}/currencies/usd.min.json`,
    `${FALLBACK}/currencies/usd.json`
  ];
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All rate endpoints failed');
}

/**
 * @param {string} [targetCurrency='USD'] e.g. PKR, USD, SAR
 */
export async function fetchLiveRates(targetCurrency) {
  try {
    if (!targetCurrency && typeof localStorage !== 'undefined') {
      targetCurrency = localStorage.getItem('miqdaar_currency') || 'USD';
    }
    targetCurrency = targetCurrency || 'USD';
    const data = await fetchUsdJson();
    const rates = data.usd || data;
    const code = targetCurrency.toLowerCase();

    // XAU / XAG: amount of metal per 1 USD → invert for USD per troy oz
    if (!rates.xau || !rates.xag) {
      return {
        success: false,
        error: 'Metal rates (XAU/XAG) missing from API',
        message: 'Live metal prices unavailable. Enter market price per gram manually.'
      };
    }

    const goldUsdPerOz = 1 / rates.xau;
    const silverUsdPerOz = 1 / rates.xag;
    const goldUsdPerGram = goldUsdPerOz / TROY_OZ_GRAMS;
    const silverUsdPerGram = silverUsdPerOz / TROY_OZ_GRAMS;

    // rates[code] = units of that currency per 1 USD
    const fx = code === 'usd' ? 1 : rates[code];
    if (!fx) {
      return {
        success: false,
        error: `Currency ${code} not in API`,
        message: `Cannot convert to ${targetCurrency}. Enter price manually.`,
        goldUsdPerGram,
        silverUsdPerGram
      };
    }

    const goldPerGram = goldUsdPerGram * fx;
    const silverPerGram = silverUsdPerGram * fx;

    return {
      success: true,
      timestamp: data.date || new Date().toISOString().slice(0, 10),
      source: 'fawazahmed0/currency-api',
      currency: code.toUpperCase(),
      // Prices in target currency per gram
      goldPerGram,
      silverPerGram,
      // Also expose USD for reference
      goldUsdPerGram,
      silverUsdPerGram,
      goldUsdPerOz,
      silverUsdPerOz,
      fxToUsd: fx,
      currencies: rates
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Live price unavailable',
      message: 'Live price unavailable. Please enter the current market price manually.'
    };
  }
}

export function convertCurrency(amount, fromCode, toCode, rates) {
  if (fromCode === toCode) return amount;
  const from = fromCode.toLowerCase();
  const to = toCode.toLowerCase();
  const fromRate = from === 'usd' ? 1 : rates[from];
  const toRate = to === 'usd' ? 1 : rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

export function getMetalPriceInCurrency(metalUsdPerGram, targetCurrency, rates) {
  if (!metalUsdPerGram || !rates) return null;
  const code = targetCurrency.toLowerCase();
  if (code === 'usd') return metalUsdPerGram;
  const rate = rates[code];
  if (!rate) return null;
  return metalUsdPerGram * rate;
}
