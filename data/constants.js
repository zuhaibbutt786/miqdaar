/**
 * Miqdaar — Core Constants
 * All religious constants are versioned and documented.
 * Rules Version: 1.0
 * Evidence Version: 1.0
 */

export const APP_VERSION = '1.0.0';
export const RULES_VERSION = '1.0';
export const EVIDENCE_VERSION = '1.0';

/** Classic Nisab weights (grams). Configurable, not hard-coded in UI logic. */
export const NISAB = {
  GOLD_GRAMS: 87.48,   // classical gold nisab
  SILVER_GRAMS: 612.36 // classical silver nisab
};

/** Standard monetary Zakat rate for qualifying wealth */
export const ZAKAT_RATE = 0.025; // 1/40

/** Supported currencies */
export const CURRENCIES = [
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
];

/** Gold purity factors (relative to 24K) */
export const GOLD_PURITY = {
  '24K': 1.0,
  '22K': 22 / 24,
  '21K': 21 / 24,
  '20K': 20 / 24,
  '18K': 18 / 24,
  'custom': null
};

/** Madhhab identifiers */
export const MADHHABS = {
  HANAFI: 'hanafi',
  SHAFII: 'shafii',
  MALIKI: 'maliki',
  HANBALI: 'hanbali',
  JAFARI: 'jafari',
  GENERAL: 'general',
  OTHER: 'other',
  UNKNOWN: 'unknown'
};

export const MADHHAB_LABELS = {
  hanafi: { en: 'Hanafi', ur: 'حنفی', ar: 'حنفي' },
  shafii: { en: "Shafi'i", ur: 'شافعی', ar: 'شافعي' },
  maliki: { en: 'Maliki', ur: 'مالکی', ar: 'مالكي' },
  hanbali: { en: 'Hanbali', ur: 'حنبلی', ar: 'حنبلي' },
  jafari: { en: "Ja'fari / Ithna Ashari", ur: 'جعفری', ar: 'جعفري' },
  general: { en: 'General View', ur: 'عمومی نظر', ar: 'نظرة عامة' },
  other: { en: 'Other / I will specify', ur: 'دیگر', ar: 'أخرى' },
  unknown: { en: "I don't know", ur: 'مجھے معلوم نہیں', ar: 'لا أعلم' }
};

/** Disclaimer text (must appear on results) */
export const DISCLAIMER = {
  en: "This application provides educational calculations based on the selected Islamic jurisprudential methodology. It is not a fatwa and does not replace a qualified mufti, Islamic scholar, lawyer, accountant or estate professional. Islamic inheritance can also interact with local civil law. Verify important estate distributions with appropriately qualified professionals.",
  ur: "یہ ایپ منتخب اسلامی فقہی طریقہ کار پر مبنی تعلیمی حسابات فراہم کرتی ہے۔ یہ فتویٰ نہیں ہے اور کسی اہل مفتی، عالم، وکیل یا اکاؤنٹنٹ کا متبادل نہیں۔ اہم تقسیم کے لیے اہل علماء سے تصدیق کروائیں۔",
  ar: "يوفر هذا التطبيق حسابات تعليمية بناءً على المنهج الفقهي المختار. ليس فتوى ولا يغني عن الرجوع إلى مفتٍ أو عالم مؤهل أو محامٍ أو محاسب. تحقق من التوزيعات المهمة مع المختصين."
};
