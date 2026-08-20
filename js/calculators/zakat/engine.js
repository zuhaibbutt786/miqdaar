/**
 * Miqdaar Zakat Engine — expanded inputs (from Android model + web V1)
 * Deterministic. Rules Version: 1.1
 */
import { NISAB, ZAKAT_RATE, GOLD_PURITY } from '../../../data/constants.js';

/**
 * @typedef {Object} ZakatInput
 * @property {string} methodology
 * @property {string} currency
 * @property {number} cashAtHome
 * @property {number} bankAccounts
 * @property {number} mobileWallets
 * @property {number} foreignCurrency
 * @property {number} receivables
 * @property {Object} gold
 * @property {Object} silver
 * @property {number} businessInventory
 * @property {number} businessCash
 * @property {number} businessReceivables
 * @property {number} sharesTrading
 * @property {number} sharesDividendsPortion
 * @property {number} mutualFundsPortion
 * @property {number} propertyForResale
 * @property {number} cryptoTrading
 * @property {number} debtsDue
 * @property {number} shortTermLiabilities
 * @property {number} pendingBills
 * @property {number} goldPricePerGram
 * @property {number} silverPricePerGram
 * @property {boolean} useSilverNisab
 * @property {string} jewelryUsage - PERSONAL_USE_ONLY | INVESTMENT_OR_SAVINGS | MIXED
 */

export function calculateZakat(input) {
  const warnings = [];
  const evidence = [];
  const assumptions = [];
  const breakdown = [];

  const cashTotal =
    (input.cashAtHome || 0) +
    (input.bankAccounts || 0) +
    (input.mobileWallets || 0) +
    (input.foreignCurrency || 0) +
    (input.receivables || 0) +
    (input.cash || 0); // backward compat

  if (cashTotal < 0 || (input.gold?.weightGrams || 0) < 0) {
    return { success: false, error: 'Negative values are not allowed.', code: 'INVALID_INPUT' };
  }

  if (cashTotal > 0) {
    breakdown.push({ category: 'Cash & liquidity', amount: cashTotal, note: 'Cash, bank, wallets, foreign currency, good receivables' });
  }

  // Gold
  let goldValue = 0;
  let jewelryExempted = 0;
  if (input.gold && input.gold.weightGrams > 0) {
    const purityFactor = GOLD_PURITY[input.gold.purity] ?? 1;
    const pureGrams = input.gold.weightGrams * purityFactor;
    const price = input.gold.pricePerGram || input.goldPricePerGram || 0;
    goldValue = pureGrams * price;

    const usage = input.jewelryUsage || (input.gold.jewelryPersonalUse ? 'PERSONAL_USE_ONLY' : 'INVESTMENT_OR_SAVINGS');
    if (usage === 'PERSONAL_USE_ONLY' || usage === 'MIXED') {
      const treatment = getJewelryTreatment(input.methodology);
      if (treatment === 'exempt' && usage === 'PERSONAL_USE_ONLY') {
        jewelryExempted = goldValue;
        goldValue = 0;
        assumptions.push('Personal-use gold jewelry treated as non-zakatable under selected methodology.');
        warnings.push({ type: 'methodology', message: 'Personal-use jewelry is exempt in your selected school. Hanafi/Jaʿfarī generally include it.' });
      } else if (usage === 'MIXED') {
        warnings.push({ type: 'info', message: 'Mixed jewelry (personal + savings): only the investment portion should be included. Adjust weight or consult a scholar.' });
        assumptions.push('Mixed jewelry: full value included pending user split — verify portion held as savings.');
      }
    }
    if (goldValue > 0) breakdown.push({ category: 'Gold', amount: goldValue, note: `Purity ${input.gold.purity || '24K'}` });
  }

  // Silver
  let silverValue = 0;
  if (input.silver && input.silver.weightGrams > 0) {
    const price = input.silver.pricePerGram || input.silverPricePerGram || 0;
    silverValue = input.silver.weightGrams * (input.silver.purity ?? 1) * price;
    if (silverValue > 0) breakdown.push({ category: 'Silver', amount: silverValue, note: '' });
  }

  // Business (trade only)
  const bizInv = Math.max(0, input.businessInventory || 0);
  const bizCash = Math.max(0, input.businessCash || 0);
  const bizRecv = Math.max(0, input.businessReceivables || 0);
  const businessTotal = bizInv + bizCash + bizRecv;
  if (businessTotal > 0) {
    breakdown.push({ category: 'Business (trade assets)', amount: businessTotal, note: 'Inventory for sale + business cash/receivables. Fixed assets excluded.' });
    assumptions.push('Shop building, machinery, furniture, delivery vehicles are not included as trading stock.');
  }

  // Investments
  const inv =
    Math.max(0, input.sharesTrading || 0) +
    Math.max(0, input.sharesDividendsPortion || 0) +
    Math.max(0, input.mutualFundsPortion || 0) +
    Math.max(0, input.propertyForResale || 0) +
    Math.max(0, input.cryptoTrading || 0);
  if (inv > 0) {
    breakdown.push({ category: 'Investments (zakatable portion)', amount: inv, note: 'Trading shares, resale property, trading crypto, zakatable fund portion' });
    warnings.push({ type: 'info', message: 'Long-term investments held only for dividends/rent may follow different rules by school. Verify complex cases with a scholar.' });
  }

  const debts =
    Math.max(0, input.debtsDue || 0) +
    Math.max(0, input.shortTermLiabilities || 0) +
    Math.max(0, input.pendingBills || 0);
  if (debts > 0) {
    assumptions.push('Only immediate / short-term liabilities deducted. Long-term loans are not fully deducted automatically.');
  }

  const gross = cashTotal + goldValue + silverValue + businessTotal + inv;
  const net = Math.max(0, gross - debts);

  const goldNisabValue = NISAB.GOLD_GRAMS * (input.goldPricePerGram || input.gold?.pricePerGram || 0);
  const silverNisabValue = NISAB.SILVER_GRAMS * (input.silverPricePerGram || input.silver?.pricePerGram || 0);
  // Classical preference for cash: silver nisab often used to benefit the poor
  const applicableNisab = input.useSilverNisab !== false
    ? (silverNisabValue || goldNisabValue)
    : (goldNisabValue || silverNisabValue);
  const aboveNisab = net >= applicableNisab && applicableNisab > 0;

  let zakatDue = 0;
  if (aboveNisab) {
    zakatDue = net * ZAKAT_RATE;
    evidence.push({ type: 'hadith', ref: 'bukhari_1447', note: 'One-fortieth for silver (Sahih al-Bukhari).' });
    evidence.push({ type: 'quran', ref: '9:60', note: 'Zakat recipients.' });
  }

  return {
    success: true,
    rulesVersion: '1.1',
    methodology: input.methodology,
    currency: input.currency,
    breakdown: {
      cash: cashTotal,
      goldValue,
      jewelryExempted,
      silverValue,
      businessInventory: businessTotal,
      investments: inv,
      gross,
      debtsDeducted: debts,
      netZakatable: net,
      goldNisabValue,
      silverNisabValue,
      applicableNisab,
      aboveNisab,
      rate: ZAKAT_RATE,
      zakatDue: Math.round(zakatDue * 100) / 100,
      items: breakdown
    },
    evidence,
    warnings,
    assumptions,
    disclaimerRequired: true
  };
}

function getJewelryTreatment(methodology) {
  switch (methodology) {
    case 'hanafi':
    case 'jafari':
      return 'include';
    case 'shafii':
    case 'maliki':
    case 'hanbali':
      return 'exempt';
    case 'general':
    case 'unknown':
      return 'include';
    default:
      return 'scholar';
  }
}

export function isAboveNisab(netWealth, goldPricePerGram, silverPricePerGram, preferSilver = true) {
  const g = NISAB.GOLD_GRAMS * goldPricePerGram;
  const s = NISAB.SILVER_GRAMS * silverPricePerGram;
  const n = preferSilver ? (s || g) : (g || s);
  return netWealth >= n && n > 0;
}
